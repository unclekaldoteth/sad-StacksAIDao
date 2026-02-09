/**
 * API Routes Integration Tests
 * Tests HTTP endpoints with mocked DAOAgent
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express } from 'express';
import { apiRouter } from '../src/api/routes.js';

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
        stacks: { network: 'testnet', daoDeployer: 'ST1TEST' },
    },
}));

import { getLLMProvider, ProviderFactory } from '../src/providers/index.js';

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

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api', apiRouter);

        // Reset mocks
        vi.mocked(getLLMProvider).mockReturnValue({
            name: 'mock',
            complete: async () => ({ content: '{"summary":"test","riskLevel":"low","recommendation":"approve","reasoning":"ok","keyPoints":[]}' }),
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
    // Analyze Proposal
    // ==========================================

    describe('POST /api/analyze-proposal', () => {
        it('analyzes valid proposal', async () => {
            const res = await request(app, 'POST', '/api/analyze-proposal', {
                daoAddress: 'ST1TEST',
                proposal: {
                    id: 1,
                    title: 'Test Proposal',
                    description: 'A test proposal for unit testing',
                    proposer: 'ST1ALICE',
                    amount: 100,
                },
            });

            expect(res.status).toBe(200);
            expect(res.body.proposalId).toBe(1);
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
            vi.mocked(getLLMProvider).mockReturnValue({
                name: 'mock',
                complete: async () => ({ content: '{"vote":"for","confidence":85,"reasoning":"Good proposal"}' }),
                isAvailable: async () => true,
                getModel: () => 'mock-model',
            } as any);
        });

        it('returns voting recommendation', async () => {
            const res = await request(app, 'POST', '/api/voting-recommendation', {
                daoAddress: 'ST1TEST',
                proposal: {
                    id: 1,
                    title: 'Community Fund',
                    description: 'Allocate funds for community',
                },
            });

            expect(res.status).toBe(200);
            expect(res.body.proposalId).toBe(1);
            expect(res.body.vote).toBeDefined();
            expect(res.body.confidence).toBeTypeOf('number');
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
            vi.mocked(getLLMProvider).mockReturnValue({
                name: 'mock',
                complete: async () => ({ content: '{"healthScore":80,"recommendations":["Diversify"]}' }),
                isAvailable: async () => true,
                getModel: () => 'mock-model',
            } as any);
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
            expect(res.body.totalBalance).toBe(10000);
            expect(res.body.healthScore).toBeTypeOf('number');
            expect(res.body.recommendations).toBeInstanceOf(Array);
        });

        it('handles empty transactions', async () => {
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
    // Chat
    // ==========================================

    describe('POST /api/chat', () => {
        beforeEach(() => {
            vi.mocked(getLLMProvider).mockReturnValue({
                name: 'mock',
                complete: async () => ({ content: 'A DAO is a decentralized autonomous organization.' }),
                isAvailable: async () => true,
                getModel: () => 'mock-model',
            } as any);
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
