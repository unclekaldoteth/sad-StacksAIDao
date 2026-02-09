/**
 * DAOAgent Unit Tests
 * Tests AI agent methods with mocked LLM responses
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAOAgent, extractJsonObject } from '../src/agents/dao-agent.js';

// Mock the LLM provider
vi.mock('../src/providers/index.js', () => ({
    getLLMProvider: vi.fn(),
}));

import { getLLMProvider } from '../src/providers/index.js';

const mockComplete = vi.fn();
const mockProvider = {
    name: 'mock',
    complete: mockComplete,
    isAvailable: async () => true,
    getModel: () => 'mock-model',
};

beforeEach(() => {
    vi.mocked(getLLMProvider).mockReturnValue(mockProvider as any);
    mockComplete.mockReset();
});

afterEach(() => {
    vi.clearAllMocks();
});

// ===========================================
// extractJsonObject Tests
// ===========================================

describe('extractJsonObject', () => {
    it('parses direct JSON objects', () => {
        const parsed = extractJsonObject('{"summary":"ok","riskLevel":"low"}');
        expect(parsed).toEqual({ summary: 'ok', riskLevel: 'low' });
    });

    it('parses fenced JSON with json tag', () => {
        const parsed = extractJsonObject('```json\n{"vote":"for","confidence":80}\n```');
        expect(parsed).toEqual({ vote: 'for', confidence: 80 });
    });

    it('parses fenced JSON without json tag', () => {
        const parsed = extractJsonObject('```\n{"healthScore":75}\n```');
        expect(parsed).toEqual({ healthScore: 75 });
    });

    it('parses JSON embedded in natural language text', () => {
        const parsed = extractJsonObject('Here is the result:\n{"healthScore":91}\nThanks!');
        expect(parsed).toEqual({ healthScore: 91 });
    });

    it('returns null for invalid payload', () => {
        const parsed = extractJsonObject('not-json-response');
        expect(parsed).toBeNull();
    });

    it('returns null for empty string', () => {
        const parsed = extractJsonObject('');
        expect(parsed).toBeNull();
    });

    it('returns null for array JSON (only objects supported)', () => {
        const parsed = extractJsonObject('[1, 2, 3]');
        expect(parsed).toBeNull();
    });

    it('handles nested JSON objects', () => {
        const parsed = extractJsonObject('{"outer":{"inner":"value"}}');
        expect(parsed).toEqual({ outer: { inner: 'value' } });
    });
});

// ===========================================
// DAOAgent.analyzeProposal Tests
// ===========================================

describe('DAOAgent.analyzeProposal', () => {
    it('returns analysis with parsed JSON response', async () => {
        mockComplete.mockResolvedValue({
            content: JSON.stringify({
                summary: 'Fund community event',
                riskLevel: 'low',
                recommendation: 'approve',
                reasoning: 'Well-aligned with community goals',
                keyPoints: ['Community benefit', 'Low cost', 'Clear plan'],
            }),
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.analyzeProposal({
            id: 1,
            title: 'Community Event Fund',
            description: 'Allocate 100 STX for community meetup',
            proposer: 'ST1ALICE',
            amount: 100,
        });

        expect(result).toEqual({
            proposalId: 1,
            title: 'Community Event Fund',
            summary: 'Fund community event',
            riskLevel: 'low',
            recommendation: 'approve',
            reasoning: 'Well-aligned with community goals',
            keyPoints: ['Community benefit', 'Low cost', 'Clear plan'],
        });
    });

    it('handles high risk proposals', async () => {
        mockComplete.mockResolvedValue({
            content: JSON.stringify({
                summary: 'Large treasury withdrawal',
                riskLevel: 'high',
                recommendation: 'reject',
                reasoning: 'Too high of a fund allocation',
                keyPoints: ['50% of treasury', 'Unknown recipient', 'No oversight'],
            }),
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.analyzeProposal({
            id: 2,
            title: 'Withdraw 10000 STX',
            description: 'Send 10000 STX to external address',
            proposer: 'ST1BOB',
            amount: 10000,
        });

        expect(result.riskLevel).toBe('high');
        expect(result.recommendation).toBe('reject');
    });

    it('falls back to defaults when JSON parsing fails', async () => {
        mockComplete.mockResolvedValue({
            content: 'I cannot parse this proposal properly.',
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.analyzeProposal({
            id: 3,
            title: 'Test Proposal',
            description: 'Test description',
            proposer: 'ST1TEST',
        });

        expect(result.proposalId).toBe(3);
        expect(result.riskLevel).toBe('medium');
        expect(result.recommendation).toBe('abstain');
        expect(result.reasoning).toBe('Analysis incomplete - please review manually');
    });

    it('normalizes invalid risk levels to medium', async () => {
        mockComplete.mockResolvedValue({
            content: JSON.stringify({
                summary: 'Test',
                riskLevel: 'extreme', // Invalid value
                recommendation: 'approve',
                reasoning: 'OK',
            }),
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.analyzeProposal({
            id: 4,
            title: 'Test',
            description: 'Test',
            proposer: 'ST1TEST',
        });

        expect(result.riskLevel).toBe('medium');
    });
});

// ===========================================
// DAOAgent.getVotingRecommendation Tests
// ===========================================

describe('DAOAgent.getVotingRecommendation', () => {
    it('returns vote recommendation with high confidence', async () => {
        mockComplete.mockResolvedValue({
            content: JSON.stringify({
                vote: 'for',
                confidence: 90,
                reasoning: 'Proposal aligns with DAO objectives',
            }),
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.getVotingRecommendation({
            id: 1,
            title: 'Upgrade Smart Contract',
            description: 'Deploy v2 of governance contract',
        });

        expect(result).toEqual({
            proposalId: 1,
            vote: 'for',
            confidence: 90,
            reasoning: 'Proposal aligns with DAO objectives',
        });
    });

    it('handles against recommendation', async () => {
        mockComplete.mockResolvedValue({
            content: JSON.stringify({
                vote: 'against',
                confidence: 75,
                reasoning: 'Proposal lacks proper security audit',
            }),
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.getVotingRecommendation({
            id: 2,
            title: 'Risky Integration',
            description: 'Integrate with unaudited protocol',
        });

        expect(result.vote).toBe('against');
        expect(result.confidence).toBe(75);
    });

    it('incorporates user preferences in recommendation', async () => {
        mockComplete.mockResolvedValue({
            content: JSON.stringify({
                vote: 'abstain',
                confidence: 40,
                reasoning: 'Conflicts with user preference for security-first approach',
            }),
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.getVotingRecommendation(
            { id: 3, title: 'Move Fast', description: 'Ship without audit' },
            'I prioritize security over speed'
        );

        expect(result.vote).toBe('abstain');
        expect(result.reasoning).toContain('security');
    });

    it('clamps confidence to valid range', async () => {
        mockComplete.mockResolvedValue({
            content: JSON.stringify({
                vote: 'for',
                confidence: 150, // Out of range
                reasoning: 'Test',
            }),
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.getVotingRecommendation({
            id: 4,
            title: 'Test',
            description: 'Test',
        });

        expect(result.confidence).toBe(100);
    });

    it('falls back when JSON invalid', async () => {
        mockComplete.mockResolvedValue({
            content: 'Unable to determine vote',
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.getVotingRecommendation({
            id: 5,
            title: 'Test',
            description: 'Test',
        });

        expect(result.vote).toBe('abstain');
        expect(result.confidence).toBe(0);
    });
});

// ===========================================
// DAOAgent.analyzeTreasury Tests
// ===========================================

describe('DAOAgent.analyzeTreasury', () => {
    it('returns treasury insights', async () => {
        mockComplete.mockResolvedValue({
            content: JSON.stringify({
                healthScore: 85,
                recommendations: [
                    'Diversify holdings',
                    'Consider yield strategies',
                ],
            }),
        });

        const treasuryData = {
            balance: 50000,
            recentTransactions: [
                { amount: 100, recipient: 'ST1ALICE', timestamp: 1000 },
                { amount: 200, recipient: 'ST1BOB', timestamp: 1001 },
            ],
        };

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.analyzeTreasury(treasuryData);

        expect(result).toEqual({
            totalBalance: 50000,
            recentSpends: treasuryData.recentTransactions,
            healthScore: 85,
            recommendations: ['Diversify holdings', 'Consider yield strategies'],
        });
    });

    it('handles low health score', async () => {
        mockComplete.mockResolvedValue({
            content: JSON.stringify({
                healthScore: 20,
                recommendations: ['Reduce spending', 'Seek additional funding'],
            }),
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.analyzeTreasury({
            balance: 100,
            recentTransactions: [],
        });

        expect(result.healthScore).toBe(20);
        expect(result.recommendations).toHaveLength(2);
    });

    it('clamps health score to valid range', async () => {
        mockComplete.mockResolvedValue({
            content: JSON.stringify({
                healthScore: -10,
                recommendations: [],
            }),
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.analyzeTreasury({
            balance: 0,
            recentTransactions: [],
        });

        expect(result.healthScore).toBe(0);
    });

    it('falls back on parse failure', async () => {
        mockComplete.mockResolvedValue({
            content: 'Treasury analysis unavailable',
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.analyzeTreasury({
            balance: 1000,
            recentTransactions: [],
        });

        expect(result.healthScore).toBe(50);
        expect(result.recommendations).toEqual(['Unable to generate detailed analysis']);
    });
});

// ===========================================
// DAOAgent.evaluateAction Tests
// ===========================================

describe('DAOAgent.evaluateAction', () => {
    it('allows auto-execution for low risk actions', async () => {
        const agent = new DAOAgent('ST1TEST');
        const result = await agent.evaluateAction({
            type: 'vote',
            description: 'Cast vote on proposal',
            riskLevel: 'low',
            requiresApproval: false,
        });

        expect(result.canAutoExecute).toBe(true);
        expect(result.reason).toContain('Low-risk');
    });

    it('blocks auto-execution for medium risk', async () => {
        const agent = new DAOAgent('ST1TEST');
        const result = await agent.evaluateAction({
            type: 'spend',
            description: 'Small treasury spend',
            riskLevel: 'medium',
            requiresApproval: false,
        });

        expect(result.canAutoExecute).toBe(false);
        expect(result.reason).toContain('medium risk');
    });

    it('blocks auto-execution for high risk', async () => {
        const agent = new DAOAgent('ST1TEST');
        const result = await agent.evaluateAction({
            type: 'upgrade',
            description: 'Contract upgrade',
            riskLevel: 'high',
            requiresApproval: false,
        });

        expect(result.canAutoExecute).toBe(false);
        expect(result.reason).toContain('high risk');
    });

    it('blocks when approval explicitly required', async () => {
        const agent = new DAOAgent('ST1TEST');
        const result = await agent.evaluateAction({
            type: 'vote',
            description: 'Vote',
            riskLevel: 'low',
            requiresApproval: true,
        });

        expect(result.canAutoExecute).toBe(false);
        expect(result.reason).toContain('explicitly requires');
    });
});

// ===========================================
// DAOAgent.chat Tests
// ===========================================

describe('DAOAgent.chat', () => {
    it('returns chat response', async () => {
        mockComplete.mockResolvedValue({
            content: 'A DAO is a decentralized autonomous organization...',
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.chat('What is a DAO?');

        expect(result).toBe('A DAO is a decentralized autonomous organization...');
    });

    it('includes context in system prompt', async () => {
        mockComplete.mockResolvedValue({
            content: 'Your treasury has 5000 STX...',
        });

        const agent = new DAOAgent('ST1TEST');
        await agent.chat('How much is in our treasury?', {
            daoAddress: 'ST1TEST',
            userAddress: 'ST1ALICE',
            treasuryBalance: 5000,
        });

        // Verify context was passed to LLM
        const call = mockComplete.mock.calls[0][0];
        expect(call.messages[0].content).toContain('ST1TEST');
    });

    it('handles context without user address', async () => {
        mockComplete.mockResolvedValue({
            content: 'Response',
        });

        const agent = new DAOAgent('ST1TEST');
        const result = await agent.chat('Hello', {
            daoAddress: 'ST1TEST',
        });

        expect(result).toBe('Response');
    });
});
