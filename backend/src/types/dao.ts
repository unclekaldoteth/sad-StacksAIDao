/**
 * DAO Agent Types
 */

export interface ProposalAnalysis {
    proposalId: number;
    title: string;
    summary: string;
    riskLevel: 'low' | 'medium' | 'high';
    recommendation: 'approve' | 'reject' | 'abstain';
    reasoning: string;
    keyPoints: string[];
}

export interface VotingRecommendation {
    proposalId: number;
    vote: 'for' | 'against' | 'abstain';
    confidence: number; // 0-100
    reasoning: string;
}

export interface TreasuryInsight {
    totalBalance: number;
    recentSpends: {
        amount: number;
        recipient: string;
        timestamp: number;
    }[];
    healthScore: number; // 0-100
    recommendations: string[];
}

export type AgentActionType =
    | 'propose'
    | 'vote'
    | 'execute'
    | 'notify'
    | 'spend'
    | 'upgrade'
    // Allow additional action types without weakening autocomplete for known ones.
    | (string & {});

export interface AgentAction {
    type: AgentActionType;
    requiresApproval: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    description: string;
    data?: unknown;
}

export interface AgentContext {
    daoAddress: string;
    userAddress?: string;
    recentProposals?: unknown[];
    treasuryBalance?: number;
}
