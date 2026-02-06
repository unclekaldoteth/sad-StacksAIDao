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

export interface AgentAction {
    type: 'propose' | 'vote' | 'execute' | 'notify';
    requiresApproval: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    description: string;
    data: unknown;
}

export interface AgentContext {
    daoAddress: string;
    userAddress?: string;
    recentProposals?: unknown[];
    treasuryBalance?: number;
}
