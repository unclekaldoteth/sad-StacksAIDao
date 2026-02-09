/**
 * API Routes Integration Tests
 * Tests HTTP endpoints with mocked DAOAgent
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express } from 'express';
import { apiRouter } from '../src/api/routes.js';

// Mock DAO registry (multi-DAO support)
vi.mock('../src/dao-registry/index.js', () => ({
    listDaos: vi.fn(async () => ({
        factoryContractId: 'ST1TEST.dao-factory',
        defaultDaoId: '1',
        daos: [],
    })),
    resolveDaoContext: vi.fn(async () => ({
        network: 'testnet',
        stacksApiUrl: 'http://mock',
        deployerAddress: 'ST1TEST',
        contracts: {
            core: 'ST1TEST.dao-core',
            proposals: 'ST1TEST.proposal-submission',
            voting: 'ST1TEST.proposal-voting',
            treasury: 'ST1TEST.treasury',
            treasuryActions: 'ST1TEST.treasury-actions',
            governanceToken: 'ST1TEST.governance-token',
            membership: 'ST1TEST.membership',
            extensionsRegistry: 'ST1TEST.extensions-registry',
            templateRegistry: 'ST1TEST.template-registry',
            factory: 'ST1TEST.dao-factory',
        },
        daoId: '1',
        name: 'Test DAO',
    })),
}));

// Mock on-chain reads (DAO state)
vi.mock('../src/stacks/dao-state.js', () => ({
    fetchDaoOverview: vi.fn(async () => ({
        dao: { name: 'Test DAO', description: 'Test description' },
        counts: { members: '100', proposals: '1' },
        treasury: {
            stxBalance: '100000000', // 100 STX
            totalReceived: '0',
            totalSpent: '0',
            spendCount: '1',
        },
    })),
    fetchDaoProposals: vi.fn(async () => ({
        proposals: [
            {
                id: '1',
                title: 'On-chain Title',
                description: 'Urgent transfer to ST1RECIPIENT for security patch',
                proposer: 'ST1ONCHAIN',
                status: 'active',
                createdAtBlock: '100',
                startBlock: '110',
                endBlock: '120',
                proposalContract: null,
                votes: {
                    for: '10',
                    against: '2',
                    abstain: '0',
                    total: '12',
                    voterCount: '0',
                },
            },
        ],
    })),
    fetchDaoProposalById: vi.fn(async (id: bigint) => ({
        id: id.toString(),
        title: 'On-chain Title',
        description: 'Urgent transfer to ST1RECIPIENT for security patch',
        proposer: 'ST1ONCHAIN',
        status: 'active',
        createdAtBlock: '100',
        startBlock: '110',
        endBlock: '120',
        proposalContract: null,
        votes: {
            for: '10',
            against: '2',
            abstain: '0',
            total: '12',
            voterCount: '0',
        },
    })),
    fetchDaoTreasury: vi.fn(async () => ({
        stats: {
            stxBalance: '100000000', // 100 STX
            totalReceived: '0',
            totalSpent: '0',
            spendCount: '1',
        },
        recentSpends: [
            {
                spendId: '1',
                asset: 'STX',
                amount: '25000000', // 25 STX (25% of 100 STX)
                recipient: 'ST1ALICE',
                proposalId: null,
                spentAtBlock: '999',
                spentBy: 'ST1DAO',
            },
        ],
    })),
    fetchVotingPower: vi.fn(async (address: string) => ({
        address,
        votingPower: '0',
        totalVotingPower: '0',
    })),
}));

// Mock the providers
vi.mock('../src/providers/index.js', () => ({
    getLLMProvider: vi.fn(() => ({
        name: 'mock',
        complete: async () => ({ content: '{}' }),
        isAvailable: async () => true,
        getModel: () => 'mock-model',
    })),
    ProviderFactory: {
        checkAvailability: vi.fn(() => Promise.resolve(true)),
    },
}));

// Mock the config
vi.mock('../src/config/index.js', () => ({
    config: {
        llm: { provider: 'mock' },
        stacks: { network: 'testnet', daoDeployer: 'ST1TEST', apiUrl: 'http://mock' },
    },
}));

import { getLLMProvider, ProviderFactory } from '../src/providers/index.js';
import { fetchDaoTreasury } from '../src/stacks/dao-state.js';

// Simple request helper
async function request(app: Express, method: string, path: string, body?: object) {
    const { createServer } = await import('http');
    const server = createServer(app);

    return new Promise<{ status: number; body: any }>((resolve, reject) => {
        server.listen(0, 'localhost', () => {
            const addr = server.address() as { port: number };
            const port = addr.port;

            const options: RequestInit = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };

            if (body) {
                options.body = JSON.stringify(body);
            }

            fetch(`http://localhost:${port}${path}`, options)
                .then(async (res) => {
                    const json = await res.json();
                    server.close();
                    resolve({ status: res.status, body: json });
                })
                .catch((err) => {
                    server.close();
                    reject(err);
                });
        });
    });
}

describe('API Routes', () => {
    let app: Express;
    const completeMock = vi.fn();

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api', apiRouter);

        // Reset mocks
        completeMock.mockReset();
        completeMock.mockResolvedValue({
            content: '{"summary":"test","riskLevel":"low","recommendation":"approve","reasoning":"ok","keyPoints":[]}',
        });
        vi.mocked(getLLMProvider).mockReturnValue({
            name: 'mock',
            complete: completeMock,
            isAvailable: async () => true,
            getModel: () => 'mock-model',
        } as any);

        vi.mocked(ProviderFactory.checkAvailability).mockResolvedValue(true);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // ==========================================
    // Health Check
    // ==========================================

    describe('GET /api/health', () => {
        it('returns health status with LLM info', async () => {
            const res = await request(app, 'GET', '/api/health');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body.llm).toBeDefined();
            expect(res.body.llm.available).toBe(true);
            expect(res.body.stacks).toBeDefined();
        });

        it('reports LLM unavailable when check fails', async () => {
            vi.mocked(ProviderFactory.checkAvailability).mockResolvedValue(false);

            const res = await request(app, 'GET', '/api/health');

            expect(res.status).toBe(200);
            expect(res.body.llm.available).toBe(false);
        });
    });

    // ==========================================
    // Provider Info
    // ==========================================

    describe('GET /api/provider', () => {
        it('returns provider details', async () => {
            const res = await request(app, 'GET', '/api/provider');

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('mock');
            expect(res.body.model).toBe('mock-model');
            expect(res.body.available).toBe(true);
        });
    });

    // ==========================================
    // DAO Registry
    // ==========================================

    describe('GET /api/daos', () => {
        it('returns DAO registry payload', async () => {
            const res = await request(app, 'GET', '/api/daos');

            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
            expect(res.body.daos).toBeInstanceOf(Array);
        });
    });

    // ==========================================
    // Analyze Proposal
    // ==========================================

    describe('POST /api/analyze-proposal', () => {
        it('analyzes valid proposal', async () => {
            const res = await request(app, 'POST', '/api/analyze-proposal', {
                daoAddress: 'ST1TEST',
                proposal: {
                    id: 1,
                    title: 'Client Title',
                    description: 'Client Description',
                    proposer: 'ST1CLIENT',
                    amount: 100,
                },
            });

            expect(res.status).toBe(200);
            expect(res.body.proposalId).toBe(1);
            expect(res.body.title).toBe('On-chain Title');
            expect(res.body.riskLevel).toBeDefined();
            expect(res.body.recommendation).toBeDefined();
        });

        it('returns 400 for missing daoAddress', async () => {
            const res = await request(app, 'POST', '/api/analyze-proposal', {
                proposal: {
                    id: 1,
                    title: 'Test',
                    description: 'Test',
                    proposer: 'ST1ALICE',
                },
            });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid request body');
        });

        it('returns 400 for invalid proposal structure', async () => {
            const res = await request(app, 'POST', '/api/analyze-proposal', {
                daoAddress: 'ST1TEST',
                proposal: {
                    id: 'not-a-number',  // Should be number
                    title: '',           // Should be non-empty
                },
            });

            expect(res.status).toBe(400);
        });
    });

    // ==========================================
    // Voting Recommendation
    // ==========================================

    describe('POST /api/voting-recommendation', () => {
        beforeEach(() => {
            completeMock.mockReset();
            completeMock.mockResolvedValue({
                content: '{"vote":"for","confidence":85,"reasoning":"Good proposal"}',
            });
        });

        it('returns voting recommendation', async () => {
            const res = await request(app, 'POST', '/api/voting-recommendation', {
                daoAddress: 'ST1TEST',
                proposal: {
                    id: 1,
                    title: 'Client Title',
                    description: 'Client Description',
                },
            });

            expect(res.status).toBe(200);
            expect(res.body.proposalId).toBe(1);
            expect(res.body.vote).toBeDefined();
            expect(res.body.confidence).toBeTypeOf('number');

            const llmCall = completeMock.mock.calls[0]?.[0] as any;
            expect(llmCall).toBeDefined();
            expect(llmCall.messages?.[1]?.content).toContain('Title: On-chain Title');
        });

        it('accepts additional proposal context fields', async () => {
            const res = await request(app, 'POST', '/api/voting-recommendation', {
                daoAddress: 'ST1TEST',
                proposal: {
                    id: 10,
                    title: 'Context Proposal',
                    description: 'Proposal with extra metadata',
                    proposer: 'ST1ALICE',
                    votesFor: 12,
                    votesAgainst: 3,
                },
            });

            expect(res.status).toBe(200);
            expect(res.body.proposalId).toBe(10);
        });

        it('accepts optional userPreferences', async () => {
            const res = await request(app, 'POST', '/api/voting-recommendation', {
                daoAddress: 'ST1TEST',
                proposal: {
                    id: 2,
                    title: 'Security Upgrade',
                    description: 'Upgrade security module',
                },
                userPreferences: 'I prioritize security and stability',
            });

            expect(res.status).toBe(200);
            expect(res.body.proposalId).toBe(2);
        });
    });

    // ==========================================
    // Analyze Treasury
    // ==========================================

    describe('POST /api/analyze-treasury', () => {
        beforeEach(() => {
            completeMock.mockReset();
            completeMock.mockResolvedValue({
                content: '{"healthScore":80,"recommendations":["Diversify"]}',
            });
        });

        it('returns treasury analysis', async () => {
            const res = await request(app, 'POST', '/api/analyze-treasury', {
                daoAddress: 'ST1TEST',
                treasuryData: {
                    balance: 10000,
                    recentTransactions: [
                        { amount: 100, recipient: 'ST1ALICE', timestamp: 1234567890 },
                    ],
                },
            });

            expect(res.status).toBe(200);
            // Backend prefers on-chain data as source of truth (mocked at 100 STX).
            expect(res.body.totalBalance).toBe(100);
            expect(res.body.healthScore).toBeTypeOf('number');
            expect(res.body.recommendations).toBeInstanceOf(Array);
        });

        it('handles empty transactions', async () => {
            vi.mocked(fetchDaoTreasury).mockResolvedValueOnce({
                stats: {
                    stxBalance: '100000000',
                    totalReceived: '0',
                    totalSpent: '0',
                    spendCount: '0',
                },
                recentSpends: [],
            } as any);

            const res = await request(app, 'POST', '/api/analyze-treasury', {
                daoAddress: 'ST1TEST',
                treasuryData: {
                    balance: 5000,
                    recentTransactions: [],
                },
            });

            expect(res.status).toBe(200);
            expect(res.body.recentSpends).toEqual([]);
        });
    });

    // ==========================================
    // DAO Alerts
    // ==========================================

    describe('GET /api/dao/alerts', () => {
        it('returns risk alerts from on-chain context', async () => {
            const res = await request(app, 'GET', '/api/dao/alerts');

            expect(res.status).toBe(200);
            expect(res.body.riskScore).toBeTypeOf('number');
            expect(res.body.alerts).toBeInstanceOf(Array);
            expect(res.body.scanned).toBeDefined();
            expect(res.body.generatedAt).toBeTypeOf('string');
        });
    });

    // ==========================================
    // Chat
    // ==========================================

    describe('POST /api/chat', () => {
        beforeEach(() => {
            completeMock.mockReset();
            completeMock.mockResolvedValue({
                content: 'A DAO is a decentralized autonomous organization.',
            });
        });

        it('returns chat response', async () => {
            const res = await request(app, 'POST', '/api/chat', {
                daoAddress: 'ST1TEST',
                message: 'What is a DAO?',
            });

            expect(res.status).toBe(200);
            expect(res.body.response).toBeTypeOf('string');
            expect(res.body.response.length).toBeGreaterThan(0);
        });

        it('accepts optional context', async () => {
            const res = await request(app, 'POST', '/api/chat', {
                daoAddress: 'ST1TEST',
                message: 'How is our treasury?',
                context: {
                    daoAddress: 'ST1TEST',
                    userAddress: 'ST1ALICE',
                    treasuryBalance: 5000,
                },
            });

            expect(res.status).toBe(200);
            expect(res.body.response).toBeDefined();
        });

        it('returns 400 for empty message', async () => {
            const res = await request(app, 'POST', '/api/chat', {
                daoAddress: 'ST1TEST',
                message: '',
            });

            expect(res.status).toBe(400);
        });
    });
});
