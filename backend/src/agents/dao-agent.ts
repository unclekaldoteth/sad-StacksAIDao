/**
 * DAO Governance Agent
 * AI-powered governance assistance
 */

import { getLLMProvider } from '../providers/index.js';
import type {
    ProposalAnalysis,
    VotingRecommendation,
    TreasuryInsight,
    AgentAction,
    AgentContext
} from '../types/dao.js';

const SYSTEM_PROMPT = `You are an AI governance agent for a DAO (Decentralized Autonomous Organization) on the Stacks blockchain.

Your responsibilities:
1. Analyze proposals and provide recommendations
2. Assess treasury health and spending patterns
3. Help members make informed voting decisions
4. Identify potential risks in governance actions

When analyzing proposals, consider:
- Impact on treasury
- Alignment with DAO goals
- Potential risks and benefits
- Community sentiment

Always be objective and transparent in your reasoning.
Respond in JSON format when requested.`;

export function extractJsonObject(content: string): Record<string, unknown> | null {
    const trimmed = content.trim();
    if (!trimmed) {
        return null;
    }

    const tryParse = (candidate: string): Record<string, unknown> | null => {
        try {
            const parsed = JSON.parse(candidate) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
            return null;
        } catch {
            return null;
        }
    };

    const direct = tryParse(trimmed);
    if (direct) {
        return direct;
    }

    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
        const fencedParsed = tryParse(fenced[1]);
        if (fencedParsed) {
            return fencedParsed;
        }
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        return tryParse(trimmed.slice(firstBrace, lastBrace + 1));
    }

    return null;
}

function toRiskLevel(value: unknown): 'low' | 'medium' | 'high' {
    if (value === 'low' || value === 'medium' || value === 'high') {
        return value;
    }
    return 'medium';
}

function toProposalRecommendation(value: unknown): 'approve' | 'reject' | 'abstain' {
    if (value === 'approve' || value === 'reject' || value === 'abstain') {
        return value;
    }
    return 'abstain';
}

function toVote(value: unknown): 'for' | 'against' | 'abstain' {
    if (value === 'for' || value === 'against' || value === 'abstain') {
        return value;
    }
    return 'abstain';
}

function toNumberInRange(value: unknown, min: number, max: number, fallback: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return fallback;
    }
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
}

export class DAOAgent {
    private daoAddress: string;

    constructor(daoAddress: string) {
        this.daoAddress = daoAddress;
    }

    /**
     * Analyze a proposal and provide recommendation
     */
    async analyzeProposal(proposal: {
        id: number;
        title: string;
        description: string;
        proposer: string;
        amount?: number;
    }): Promise<ProposalAnalysis> {
        const llm = getLLMProvider();

        const response = await llm.complete({
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Analyze this DAO proposal and provide a recommendation.

Proposal ID: ${proposal.id}
Title: ${proposal.title}
Description: ${proposal.description}
Proposer: ${proposal.proposer}
${proposal.amount !== undefined ? `Requested Amount: ${proposal.amount} STX` : ''}

Respond in this JSON format:
{
  "summary": "Brief summary of the proposal",
  "riskLevel": "low" | "medium" | "high",
  "recommendation": "approve" | "reject" | "abstain",
  "reasoning": "Explanation for your recommendation",
  "keyPoints": ["point1", "point2", "point3"]
}`,
                },
            ],
            temperature: 0.3,
        });

        const parsed = extractJsonObject(response.content);
        if (parsed) {
            return {
                proposalId: proposal.id,
                title: proposal.title,
                summary: typeof parsed.summary === 'string' ? parsed.summary : response.content,
                riskLevel: toRiskLevel(parsed.riskLevel),
                recommendation: toProposalRecommendation(parsed.recommendation),
                reasoning: typeof parsed.reasoning === 'string'
                    ? parsed.reasoning
                    : 'Analysis incomplete - please review manually',
                keyPoints: toStringArray(parsed.keyPoints),
            };
        }

        // Fallback if JSON parsing fails
        return {
            proposalId: proposal.id,
            title: proposal.title,
            summary: response.content,
            riskLevel: 'medium',
            recommendation: 'abstain',
            reasoning: 'Analysis incomplete - please review manually',
            keyPoints: [],
        };
    }

    /**
     * Get voting recommendation based on user preferences
     */
    async getVotingRecommendation(
        proposal: { id: number; title: string; description: string },
        userPreferences?: string
    ): Promise<VotingRecommendation> {
        const llm = getLLMProvider();

        const response = await llm.complete({
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Provide a voting recommendation for this proposal.

Proposal ID: ${proposal.id}
Title: ${proposal.title}
Description: ${proposal.description}
${userPreferences ? `User Preferences: ${userPreferences}` : ''}

Respond in this JSON format:
{
  "vote": "for" | "against" | "abstain",
  "confidence": 0-100,
  "reasoning": "Why this vote is recommended"
}`,
                },
            ],
            temperature: 0.3,
        });

        const parsed = extractJsonObject(response.content);
        if (parsed) {
            return {
                proposalId: proposal.id,
                vote: toVote(parsed.vote),
                confidence: toNumberInRange(parsed.confidence, 0, 100, 0),
                reasoning: typeof parsed.reasoning === 'string'
                    ? parsed.reasoning
                    : 'Unable to determine recommendation',
            };
        }

        return {
            proposalId: proposal.id,
            vote: 'abstain',
            confidence: 0,
            reasoning: 'Unable to determine recommendation',
        };
    }

    /**
     * Analyze treasury and provide insights
     */
    async analyzeTreasury(treasuryData: {
        balance: number;
        recentTransactions: { amount: number; recipient: string; timestamp: number }[];
    }): Promise<TreasuryInsight> {
        const llm = getLLMProvider();

        const response = await llm.complete({
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Analyze this DAO treasury data and provide insights.

Current Balance: ${treasuryData.balance} STX
Recent Transactions:
${treasuryData.recentTransactions.map(t =>
                        `- ${t.amount} STX to ${t.recipient} at block ${t.timestamp}`
                    ).join('\n')}

Respond in this JSON format:
{
  "healthScore": 0-100,
  "recommendations": ["recommendation1", "recommendation2"]
}`,
                },
            ],
            temperature: 0.3,
        });

        const parsed = extractJsonObject(response.content);
        if (parsed) {
            return {
                totalBalance: treasuryData.balance,
                recentSpends: treasuryData.recentTransactions,
                healthScore: toNumberInRange(parsed.healthScore, 0, 100, 50),
                recommendations: toStringArray(parsed.recommendations),
            };
        }

        return {
            totalBalance: treasuryData.balance,
            recentSpends: treasuryData.recentTransactions,
            healthScore: 50,
            recommendations: ['Unable to generate detailed analysis'],
        };
    }

    /**
     * Determine if an action can be auto-executed (low risk)
     */
    async evaluateAction(action: AgentAction): Promise<{
        canAutoExecute: boolean;
        reason: string;
    }> {
        // Only auto-execute low-risk actions
        if (action.riskLevel !== 'low') {
            return {
                canAutoExecute: false,
                reason: `Action has ${action.riskLevel} risk level - requires approval`,
            };
        }

        if (action.requiresApproval) {
            return {
                canAutoExecute: false,
                reason: 'Action explicitly requires user approval',
            };
        }

        return {
            canAutoExecute: true,
            reason: 'Low-risk action can be auto-executed',
        };
    }

    /**
     * Chat with the agent about DAO governance
     */
    async chat(message: string, context?: AgentContext): Promise<string> {
        const llm = getLLMProvider();

        const contextInfo = context
            ? `\nContext: DAO Address: ${context.daoAddress}, User: ${context.userAddress ?? 'Anonymous'}`
            : '';

        const response = await llm.complete({
            messages: [
                { role: 'system', content: SYSTEM_PROMPT + contextInfo },
                { role: 'user', content: message },
            ],
            temperature: 0.7,
        });

        return response.content;
    }
}
