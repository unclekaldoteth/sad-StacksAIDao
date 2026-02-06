/**
 * API Client for DAO AI Agent
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Proposal {
    id: number;
    title: string;
    description: string;
    proposer: string;
    amount?: number;
}

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
    confidence: number;
    reasoning: string;
}

export interface TreasuryInsight {
    totalBalance: number;
    recentSpends: { amount: number; recipient: string; timestamp: number }[];
    healthScore: number;
    recommendations: string[];
}

export interface HealthStatus {
    status: string;
    llm: { provider: string; available: boolean };
    stacks: { network: string; deployer: string };
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    const contentType = res.headers.get('content-type') ?? '';
    let payload: unknown = null;
    if (contentType.includes('application/json')) {
        payload = await res.json();
    } else if (res.status !== 204) {
        payload = await res.text();
    }

    if (!res.ok) {
        const serverError =
            payload && typeof payload === 'object' && 'error' in payload
                ? String((payload as { error: unknown }).error)
                : null;
        throw new Error(
            `API Error (${res.status}): ${(serverError ?? res.statusText) || 'Request failed'}`
        );
    }

    return payload as T;
}

export const api = {
    health: () => request<HealthStatus>('/api/health'),

    analyzeProposal: (daoAddress: string, proposal: Proposal) =>
        request<ProposalAnalysis>('/api/analyze-proposal', {
            method: 'POST',
            body: JSON.stringify({ daoAddress, proposal }),
        }),

    getVotingRecommendation: (
        daoAddress: string,
        proposal: Pick<Proposal, 'id' | 'title' | 'description'>,
        userPreferences?: string
    ) =>
        request<VotingRecommendation>('/api/voting-recommendation', {
            method: 'POST',
            body: JSON.stringify({ daoAddress, proposal, userPreferences }),
        }),

    analyzeTreasury: (
        daoAddress: string,
        treasuryData: {
            balance: number;
            recentTransactions: { amount: number; recipient: string; timestamp: number }[];
        }
    ) =>
        request<TreasuryInsight>('/api/analyze-treasury', {
            method: 'POST',
            body: JSON.stringify({ daoAddress, treasuryData }),
        }),

    chat: (daoAddress: string, message: string) =>
        request<{ response: string }>('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ daoAddress, message }),
        }),
};
