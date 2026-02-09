import type { DaoOverviewResponse, DaoProposal, DaoTreasuryResponse } from '../stacks/dao-state.js';

export type DaoAlertLevel = 'info' | 'warning' | 'critical';
export type DaoAlertType = 'proposal' | 'treasury-spend' | 'treasury-balance' | 'participation';

export type DaoAlert = {
    id: string;
    level: DaoAlertLevel;
    type: DaoAlertType;
    title: string;
    message: string;
    proposalId?: string;
    spendId?: string;
};

export type DaoAlertsResponse = {
    generatedAt: string;
    riskScore: number; // 0-100 (higher means riskier)
    scanned: {
        proposals: number;
        spends: number;
    };
    alerts: DaoAlert[];
};

function parseUint(value: string): bigint | null {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
        return null;
    }
    try {
        return BigInt(value);
    } catch {
        return null;
    }
}

function formatMicroStx(microStx: bigint): string {
    const whole = microStx / 1_000_000n;
    const frac = microStx % 1_000_000n;
    if (frac === 0n) {
        return `${whole.toString()} STX`;
    }
    const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
    return `${whole.toString()}.${fracStr} STX`;
}

function toMembersCount(overview: DaoOverviewResponse): bigint | null {
    return parseUint(overview.counts.members);
}

function computeRiskScore(alerts: DaoAlert[]): number {
    let score = 0;
    for (const alert of alerts) {
        if (alert.level === 'critical') score += 25;
        if (alert.level === 'warning') score += 10;
        if (alert.level === 'info') score += 3;
    }
    return Math.max(0, Math.min(100, score));
}

function detectSuspiciousProposalText(text: string): { level: DaoAlertLevel; title: string; message: string } | null {
    const normalized = text.toLowerCase();
    const hasAny = (keywords: string[]) => keywords.some((k) => normalized.includes(k));

    const urgency = ['urgent', 'emergency', 'immediately', 'asap'];
    const privilege = ['upgrade', 'migrate', 'admin', 'owner', 'permission', 'whitelist', 'blacklist'];
    const treasuryAction = ['transfer', 'send', 'withdraw', 'payout', 'grant', 'payment', 'treasury'];

    // Rough principal match: ST*/SP* addresses tend to be long base32-ish strings.
    const principalLike = /s[tp][a-z0-9]{20,}/i.test(text);

    if (hasAny(urgency) && hasAny(treasuryAction)) {
        return {
            level: 'critical',
            title: 'Urgent Treasury Action',
            message: 'Proposal uses urgent language and references treasury transfers. Treat as high risk and verify details.',
        };
    }

    if (hasAny(privilege)) {
        return {
            level: 'warning',
            title: 'Privilege/Upgrade Change',
            message: 'Proposal references upgrades or permission changes. Ensure audits, clear rollout, and rollback plan.',
        };
    }

    if (principalLike && hasAny(treasuryAction)) {
        return {
            level: 'warning',
            title: 'Treasury Recipient Mentioned',
            message: 'Proposal includes an address and references treasury actions. Double-check recipient and authorization.',
        };
    }

    return null;
}

export function computeDaoAlerts(input: {
    overview: DaoOverviewResponse;
    proposals: DaoProposal[];
    treasury: DaoTreasuryResponse;
}): DaoAlertsResponse {
    const alerts: DaoAlert[] = [];
    const members = toMembersCount(input.overview) ?? 0n;

    const balanceMicroStx = parseUint(input.treasury.stats.stxBalance) ?? 0n;
    if (balanceMicroStx === 0n && (parseUint(input.treasury.stats.spendCount) ?? 0n) > 0n) {
        alerts.push({
            id: 'treasury-balance-zero',
            level: 'critical',
            type: 'treasury-balance',
            title: 'Treasury Depleted',
            message: 'Treasury balance is zero but spending history exists. Confirm the DAO has funds before approving new spends.',
        });
    }

    for (const spend of input.treasury.recentSpends) {
        const amountMicroStx = parseUint(spend.amount);
        if (!amountMicroStx) continue;

        const pct = balanceMicroStx > 0n ? Number((amountMicroStx * 100n) / balanceMicroStx) : 100;
        const level: DaoAlertLevel =
            pct >= 20 ? 'critical' : pct >= 10 ? 'warning' : pct >= 5 ? 'info' : 'info';

        if (pct >= 5) {
            alerts.push({
                id: `spend-large-${spend.spendId}`,
                level,
                type: 'treasury-spend',
                title: 'Large Treasury Spend',
                message: `Spend ${formatMicroStx(amountMicroStx)} (${pct}% of treasury balance) to ${spend.recipient}.`,
                spendId: spend.spendId,
            });
        }

        if (spend.asset === 'UNKNOWN') {
            alerts.push({
                id: `spend-unknown-asset-${spend.spendId}`,
                level: 'warning',
                type: 'treasury-spend',
                title: 'Non-STX Asset Spend',
                message: `Spend ${spend.spendId} uses a non-STX token/asset. Verify token contract and accounting.`,
                spendId: spend.spendId,
            });
        }

        if (!spend.proposalId) {
            alerts.push({
                id: `spend-no-proposal-${spend.spendId}`,
                level: 'warning',
                type: 'treasury-spend',
                title: 'Spend Not Linked To Proposal',
                message: `Spend ${spend.spendId} is not linked to a proposal. Confirm authorization and governance process.`,
                spendId: spend.spendId,
            });
        }
    }

    for (const proposal of input.proposals) {
        // Only scan active/pending proposals for governance risk signals.
        if (proposal.status !== 'active' && proposal.status !== 'pending') continue;

        const suspicious = detectSuspiciousProposalText(`${proposal.title}\n${proposal.description}`);
        if (suspicious) {
            alerts.push({
                id: `proposal-suspicious-${proposal.id}`,
                level: suspicious.level,
                type: 'proposal',
                title: suspicious.title,
                message: suspicious.message,
                proposalId: proposal.id,
            });
        }

        const voterCount = parseUint(proposal.votes.voterCount) ?? 0n;
        if (proposal.status === 'active') {
            if (voterCount === 0n && members >= 10n) {
                alerts.push({
                    id: `proposal-no-votes-${proposal.id}`,
                    level: 'warning',
                    type: 'participation',
                    title: 'Low Participation',
                    message: 'Active proposal has no votes yet. Consider pinging members before the voting window closes.',
                    proposalId: proposal.id,
                });
            } else if (voterCount > 0n && voterCount < 3n && members >= 25n) {
                alerts.push({
                    id: `proposal-few-votes-${proposal.id}`,
                    level: 'info',
                    type: 'participation',
                    title: 'Participation Below Typical',
                    message: `Active proposal has ${voterCount.toString()} voters across ${members.toString()} members.`,
                    proposalId: proposal.id,
                });
            }
        }
    }

    return {
        generatedAt: new Date().toISOString(),
        scanned: {
            proposals: input.proposals.length,
            spends: input.treasury.recentSpends.length,
        },
        riskScore: computeRiskScore(alerts),
        alerts,
    };
}

