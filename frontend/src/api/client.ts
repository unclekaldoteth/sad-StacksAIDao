/**
 * API Client for DAO AI Agent
 */

import type { ContractIdString } from '@stacks/transactions';

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
    stacks: { network: string; deployer: string; apiUrl?: string };
}

export type DaoContracts = {
    core: ContractIdString;
    proposals: ContractIdString;
    voting: ContractIdString;
    treasury: ContractIdString;
    treasuryActions: ContractIdString;
    governanceToken: ContractIdString;
    membership: ContractIdString;
    extensionsRegistry: ContractIdString;
    templateRegistry: ContractIdString;
    factory: ContractIdString;
};

export interface DaoConfig {
    network: string;
    stacksApiUrl: string;
    deployerAddress: string;
    contracts: DaoContracts;
}

export interface DaoRegistryEntry {
    daoId: string;
    name: string;
    coreContractId: ContractIdString;
    contractAddress: string;
    registeredBy: string;
    deployedAtBlock: string;
    templateId: string;
    network: string;
    stacksApiUrl: string;
    contracts: DaoContracts;
}

export interface DaoRegistryResponse {
    factoryContractId: string | null;
    defaultDaoId: string | null;
    daos: DaoRegistryEntry[];
}

export interface DaoOverview {
    dao: {
        name: string;
        description: string;
    };
    counts: {
        members: string;
        proposals: string;
    };
    treasury: {
        stxBalance: string;
        totalReceived: string;
        totalSpent: string;
        spendCount: string;
    };
}

export type DaoProposalStatus = 'pending' | 'active' | 'passed' | 'rejected' | 'expired' | 'unknown';

export interface DaoProposal {
    id: string;
    title: string;
    description: string;
    proposer: string;
    status: DaoProposalStatus;
    createdAtBlock: string;
    startBlock: string;
    endBlock: string;
    proposalContract: string | null;
    votes: {
        for: string;
        against: string;
        abstain: string;
        total: string;
        voterCount: string;
    };
}

export interface DaoProposalsResponse {
    proposals: DaoProposal[];
}

export interface DaoTreasurySpend {
    spendId: string;
    asset: 'STX' | 'UNKNOWN';
    amount: string;
    recipient: string;
    proposalId: string | null;
    spentAtBlock: string;
    spentBy: string;
}

export interface DaoTreasuryResponse {
    stats: {
        stxBalance: string;
        totalReceived: string;
        totalSpent: string;
        spendCount: string;
    };
    recentSpends: DaoTreasurySpend[];
}

export interface DaoVotingPower {
    address: string;
    votingPower: string;
    totalVotingPower: string;
}

export type DaoAlertLevel = 'info' | 'warning' | 'critical';
export type DaoAlertType = 'proposal' | 'treasury-spend' | 'treasury-balance' | 'participation';

export interface DaoAlert {
    id: string;
    level: DaoAlertLevel;
    type: DaoAlertType;
    title: string;
    message: string;
    proposalId?: string;
    spendId?: string;
}

export interface DaoAlertsResponse {
    generatedAt: string;
    riskScore: number;
    scanned: {
        proposals: number;
        spends: number;
    };
    alerts: DaoAlert[];
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
    daos: (limit?: number) => {
        const params = new URLSearchParams();
        if (limit) params.set('limit', String(limit));
        const query = params.toString();
        return request<DaoRegistryResponse>(`/api/daos${query ? `?${query}` : ''}`);
    },
    daoConfig: (daoId?: string) => {
        const params = new URLSearchParams();
        if (daoId) params.set('daoId', daoId);
        const query = params.toString();
        return request<DaoConfig>(`/api/dao/config${query ? `?${query}` : ''}`);
    },
    daoOverview: (daoId?: string) => {
        const params = new URLSearchParams();
        if (daoId) params.set('daoId', daoId);
        const query = params.toString();
        return request<DaoOverview>(`/api/dao/overview${query ? `?${query}` : ''}`);
    },
    daoProposals: (daoId?: string, limit?: number) => {
        const params = new URLSearchParams();
        if (daoId) params.set('daoId', daoId);
        if (limit) params.set('limit', String(limit));
        const query = params.toString();
        return request<DaoProposalsResponse>(`/api/dao/proposals${query ? `?${query}` : ''}`);
    },
    daoTreasury: (daoId?: string, recentSpendsLimit?: number) => {
        const params = new URLSearchParams();
        if (daoId) params.set('daoId', daoId);
        if (recentSpendsLimit) params.set('recentSpendsLimit', String(recentSpendsLimit));
        const query = params.toString();
        return request<DaoTreasuryResponse>(`/api/dao/treasury${query ? `?${query}` : ''}`);
    },
    daoAlerts: (daoId?: string, proposalLimit?: number, recentSpendsLimit?: number) => {
        const params = new URLSearchParams();
        if (daoId) params.set('daoId', daoId);
        if (proposalLimit) params.set('proposalLimit', String(proposalLimit));
        if (recentSpendsLimit) params.set('recentSpendsLimit', String(recentSpendsLimit));
        const query = params.toString();
        return request<DaoAlertsResponse>(`/api/dao/alerts${query ? `?${query}` : ''}`);
    },
    daoVotingPower: (daoId: string | undefined, address: string) => {
        const params = new URLSearchParams();
        if (daoId) params.set('daoId', daoId);
        params.set('address', address);
        const query = params.toString();
        return request<DaoVotingPower>(`/api/dao/voting-power?${query}`);
    },

    analyzeProposal: (daoAddress: string, proposal: Proposal, daoId?: string) =>
        request<ProposalAnalysis>('/api/analyze-proposal', {
            method: 'POST',
            body: JSON.stringify({ daoAddress, daoId, proposal }),
        }),

    getVotingRecommendation: (
        daoAddress: string,
        proposal: Pick<Proposal, 'id' | 'title' | 'description'> & {
            proposer?: string;
            votesFor?: number;
            votesAgainst?: number;
        },
        userPreferences?: string,
        daoId?: string
    ) =>
        request<VotingRecommendation>('/api/voting-recommendation', {
            method: 'POST',
            body: JSON.stringify({ daoAddress, daoId, proposal, userPreferences }),
        }),

    analyzeTreasury: (
        daoAddress: string,
        treasuryData: {
            balance: number;
            recentTransactions: { amount: number; recipient: string; timestamp: number }[];
        },
        daoId?: string
    ) =>
        request<TreasuryInsight>('/api/analyze-treasury', {
            method: 'POST',
            body: JSON.stringify({ daoAddress, daoId, treasuryData }),
        }),

    chat: (daoAddress: string, message: string, daoId?: string) =>
        request<{ response: string }>('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ daoAddress, daoId, message }),
        }),
};
