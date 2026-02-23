import {
    principalCV,
    uintCV,
    type ClarityValue,
} from '@stacks/transactions';
import { config } from '../config/index.js';
import { buildDaoContracts, type DaoContracts } from './dao-contracts.js';
import {
    expectBool,
    expectPrincipalString,
    expectString,
    expectTuple,
    expectUintString,
    unwrapOptional,
    unwrapResponseOk,
} from './clarity.js';
import { callReadOnlyFunction } from './read-only.js';

export type DaoNetwork = 'mainnet' | 'testnet' | (string & {});

export type DaoConfigResponse = {
    network: DaoNetwork;
    stacksApiUrl: string;
    deployerAddress: string;
    contracts: DaoContracts;
};

export type DaoOverviewResponse = {
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
};

export type DaoProposalStatus =
    | 'pending'
    | 'active'
    | 'passed'
    | 'rejected'
    | 'expired'
    | 'unknown';

export type DaoProposal = {
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
};

export type TreasurySpend = {
    spendId: string;
    asset: 'STX' | 'UNKNOWN';
    amount: string;
    recipient: string;
    proposalId: string | null;
    spentAtBlock: string;
    spentBy: string;
};

export type DaoTreasuryResponse = {
    stats: {
        stxBalance: string;
        totalReceived: string;
        totalSpent: string;
        spendCount: string;
    };
    recentSpends: TreasurySpend[];
};

export type DaoVotingPowerResponse = {
    address: string;
    votingPower: string;
    totalVotingPower: string;
};

export type DaoQueuedExecution = {
    proposalId: string;
    proposalContract: string;
    readyAtBlock: string;
    queuedAtBlock: string;
    queuedBy: string;
    executed: boolean;
    canceled: boolean;
};

export type DaoOperationsResponse = {
    timelock: {
        minDelayBlocks: string;
    };
    executor: {
        minDelayBlocks: string;
        queued: DaoQueuedExecution[];
    };
    emergency: {
        guardian: string;
        globalPaused: boolean;
    };
    guardrails: {
        maxSpendBps: string;
        blocksPerPeriod: string;
        periodLimit: string;
        currentPeriod: string;
        currentPeriodSpent: string;
    };
};

function requireDeployerAddress(): string {
    const deployerAddress = config.stacks.daoDeployer;
    if (!deployerAddress) {
        throw new Error('DAO_DEPLOYER_ADDRESS is not configured on the backend');
    }
    return deployerAddress;
}

export function getDaoConfig(): DaoConfigResponse {
    const deployerAddress = requireDeployerAddress();
    return {
        network: config.stacks.network,
        stacksApiUrl: config.stacks.apiUrl,
        deployerAddress,
        contracts: buildDaoContracts(deployerAddress),
    };
}

export type DaoReadOnlyContext = Pick<DaoConfigResponse, 'stacksApiUrl' | 'deployerAddress' | 'contracts'>;

function mapProposalStatus(statusUint: string): DaoProposalStatus {
    switch (statusUint) {
        case '1':
            return 'pending';
        case '2':
            return 'active';
        case '3':
            return 'passed';
        case '4':
            return 'rejected';
        case '6':
            return 'expired';
        default:
            return 'unknown';
    }
}

async function callDaoReadOnly(
    ctx: DaoReadOnlyContext,
    contractId: string,
    functionName: string,
    args?: ClarityValue[]
): Promise<ClarityValue> {
    return callReadOnlyFunction({
        contractId,
        functionName,
        senderAddress: ctx.deployerAddress,
        args,
        apiUrl: ctx.stacksApiUrl,
    });
}

async function fetchDaoProposalByIdWithContracts(
    ctx: DaoReadOnlyContext,
    id: bigint
): Promise<DaoProposal | null> {
    const contracts = ctx.contracts;
    const [proposalOptCv, votesCv] = await Promise.all([
        callDaoReadOnly(ctx, contracts.proposals, 'get-proposal', [uintCV(id)]),
        callDaoReadOnly(ctx, contracts.voting, 'get-proposal-votes', [uintCV(id)]),
    ]);

    const proposalCv = unwrapOptional(proposalOptCv);
    if (!proposalCv) {
        return null;
    }

    const proposal = expectTuple(proposalCv);
    const votes = expectTuple(votesCv);

    const proposalContractCv = unwrapOptional(proposal['proposal-contract']);
    const proposalContract = proposalContractCv ? expectPrincipalString(proposalContractCv) : null;

    return {
        id: id.toString(),
        title: expectString(proposal.title),
        description: expectString(proposal.description),
        proposer: expectPrincipalString(proposal.proposer),
        status: mapProposalStatus(expectUintString(proposal.status)),
        createdAtBlock: expectUintString(proposal['created-at']),
        startBlock: expectUintString(proposal['start-block']),
        endBlock: expectUintString(proposal['end-block']),
        proposalContract,
        votes: {
            for: expectUintString(votes['votes-for']),
            against: expectUintString(votes['votes-against']),
            abstain: expectUintString(votes['votes-abstain']),
            total: expectUintString(votes['total-votes']),
            voterCount: expectUintString(votes['voter-count']),
        },
    } satisfies DaoProposal;
}

export async function fetchDaoOverview(ctx?: DaoReadOnlyContext): Promise<DaoOverviewResponse> {
    const dao = ctx ?? getDaoConfig();
    const { contracts } = dao;

    const [nameCv, descriptionCv, membersCv, proposalsCv, treasuryCv] = await Promise.all([
        callDaoReadOnly(dao, contracts.core, 'get-dao-name'),
        callDaoReadOnly(dao, contracts.core, 'get-dao-description'),
        callDaoReadOnly(dao, contracts.membership, 'get-member-count'),
        callDaoReadOnly(dao, contracts.proposals, 'get-proposal-count'),
        callDaoReadOnly(dao, contracts.treasury, 'get-treasury-stats'),
    ]);

    const treasury = expectTuple(treasuryCv);

    return {
        dao: {
            name: expectString(nameCv) || 'DAO',
            description: expectString(descriptionCv) || '',
        },
        counts: {
            members: expectUintString(membersCv),
            proposals: expectUintString(proposalsCv),
        },
        treasury: {
            stxBalance: expectUintString(treasury['stx-balance']),
            totalReceived: expectUintString(treasury['total-received']),
            totalSpent: expectUintString(treasury['total-spent']),
            spendCount: expectUintString(treasury['spend-count']),
        },
    };
}

export async function fetchDaoProposals(opts?: {
    limit?: number;
    ctx?: DaoReadOnlyContext;
}): Promise<{ proposals: DaoProposal[] }> {
    const dao = opts?.ctx ?? getDaoConfig();
    const { contracts } = dao;
    const proposalCountCv = await callDaoReadOnly(dao, contracts.proposals, 'get-proposal-count');
    const proposalCount = BigInt(expectUintString(proposalCountCv));

    const ids: bigint[] = [];
    const limit = opts?.limit && opts.limit > 0 ? BigInt(opts.limit) : proposalCount;
    const start = proposalCount > limit ? proposalCount - limit + 1n : 1n;
    for (let i = start; i <= proposalCount; i += 1n) {
        ids.push(i);
    }

    // Fetch proposals (and votes) in parallel. For large DAOs we should add concurrency limits.
    const results = await Promise.all(
        ids.map((id) => fetchDaoProposalByIdWithContracts(dao, id))
    );

    return { proposals: results.filter((p): p is DaoProposal => Boolean(p)) };
}

export async function fetchDaoProposalById(id: bigint, ctx?: DaoReadOnlyContext): Promise<DaoProposal | null> {
    const dao = ctx ?? getDaoConfig();
    return fetchDaoProposalByIdWithContracts(dao, id);
}

export async function fetchDaoTreasury(opts?: {
    recentSpendsLimit?: number;
    ctx?: DaoReadOnlyContext;
}): Promise<DaoTreasuryResponse> {
    const dao = opts?.ctx ?? getDaoConfig();
    const { contracts } = dao;
    const treasuryStatsCv = await callDaoReadOnly(dao, contracts.treasury, 'get-treasury-stats');
    const stats = expectTuple(treasuryStatsCv);

    const spendCount = BigInt(expectUintString(stats['spend-count']));
    const recentLimit =
        opts?.recentSpendsLimit && opts.recentSpendsLimit > 0 ? BigInt(opts.recentSpendsLimit) : 10n;
    const start = spendCount > recentLimit ? spendCount - recentLimit + 1n : 1n;

    const spendIds: bigint[] = [];
    for (let i = start; i <= spendCount; i += 1n) {
        spendIds.push(i);
    }

    const spends = await Promise.all(
        spendIds
            .slice()
            .reverse()
            .map(async (spendId) => {
                const spendOptCv = await callDaoReadOnly(dao, contracts.treasury, 'get-spend-history', [
                    uintCV(spendId),
                ]);
                const spendCv = unwrapOptional(spendOptCv);
                if (!spendCv) {
                    return null;
                }
                const spend = expectTuple(spendCv);

                const proposalIdCv = unwrapOptional(spend['proposal-id']);
                const tokenCv = unwrapOptional(spend.token);

                return {
                    spendId: spendId.toString(),
                    asset: tokenCv ? 'UNKNOWN' : 'STX',
                    amount: expectUintString(spend.amount),
                    recipient: expectPrincipalString(spend.recipient),
                    proposalId: proposalIdCv ? expectUintString(proposalIdCv) : null,
                    spentAtBlock: expectUintString(spend['spent-at']),
                    spentBy: expectPrincipalString(spend['spent-by']),
                } satisfies TreasurySpend;
            })
    );

    return {
        stats: {
            stxBalance: expectUintString(stats['stx-balance']),
            totalReceived: expectUintString(stats['total-received']),
            totalSpent: expectUintString(stats['total-spent']),
            spendCount: expectUintString(stats['spend-count']),
        },
        recentSpends: spends.filter((s): s is TreasurySpend => Boolean(s)),
    };
}

export async function fetchVotingPower(address: string, ctx?: DaoReadOnlyContext): Promise<DaoVotingPowerResponse> {
    const dao = ctx ?? getDaoConfig();
    const { contracts } = dao;

    const [powerCv, totalCv] = await Promise.all([
        callDaoReadOnly(dao, contracts.governanceToken, 'get-voting-power', [principalCV(address)]),
        callDaoReadOnly(dao, contracts.governanceToken, 'get-total-voting-power', []),
    ]);

    const power = unwrapResponseOk(powerCv);
    const total = unwrapResponseOk(totalCv);

    return {
        address,
        votingPower: expectUintString(power),
        totalVotingPower: expectUintString(total),
    };
}

export async function fetchDaoOperations(opts?: {
    queueLimit?: number;
    ctx?: DaoReadOnlyContext;
}): Promise<DaoOperationsResponse> {
    const dao = opts?.ctx ?? getDaoConfig();
    const { contracts } = dao;

    const [
        timelockDelayCv,
        executorDelayCv,
        guardianCv,
        globalPausedCv,
        guardrailsPolicyCv,
        currentPeriodCv,
        proposalCountCv,
    ] = await Promise.all([
        callDaoReadOnly(dao, contracts.timelockController, 'get-min-delay'),
        callDaoReadOnly(dao, contracts.proposalExecutor, 'get-min-delay'),
        callDaoReadOnly(dao, contracts.emergencyGuardian, 'get-guardian'),
        callDaoReadOnly(dao, contracts.emergencyGuardian, 'is-globally-paused'),
        callDaoReadOnly(dao, contracts.treasuryGuardrails, 'get-policy'),
        callDaoReadOnly(dao, contracts.treasuryGuardrails, 'get-period-index'),
        callDaoReadOnly(dao, contracts.proposals, 'get-proposal-count'),
    ]);

    const guardrailsPolicy = expectTuple(guardrailsPolicyCv);
    const proposalCount = BigInt(expectUintString(proposalCountCv));
    const queueLimit = opts?.queueLimit && opts.queueLimit > 0 ? BigInt(opts.queueLimit) : 20n;
    const queueStart = proposalCount > queueLimit ? proposalCount - queueLimit + 1n : 1n;

    const proposalIds: bigint[] = [];
    for (let i = queueStart; i <= proposalCount; i += 1n) {
        proposalIds.push(i);
    }

    const queuedEntries = await Promise.all(
        proposalIds
            .slice()
            .reverse()
            .map(async (proposalId) => {
                const queuedCv = await callDaoReadOnly(dao, contracts.proposalExecutor, 'get-queued', [uintCV(proposalId)]);
                const queuedOpt = unwrapOptional(queuedCv);
                if (!queuedOpt) {
                    return null;
                }
                const queued = expectTuple(queuedOpt);
                return {
                    proposalId: proposalId.toString(),
                    proposalContract: expectPrincipalString(queued.proposal),
                    readyAtBlock: expectUintString(queued['ready-at']),
                    queuedAtBlock: expectUintString(queued['queued-at']),
                    queuedBy: expectPrincipalString(queued['queued-by']),
                    executed: expectBool(queued.executed),
                    canceled: expectBool(queued.canceled),
                } satisfies DaoQueuedExecution;
            })
    );

    const currentPeriod = expectUintString(currentPeriodCv);
    const currentPeriodSpentCv = await callDaoReadOnly(
        dao,
        contracts.treasuryGuardrails,
        'get-period-spent',
        [uintCV(BigInt(currentPeriod))]
    );

    return {
        timelock: {
            minDelayBlocks: expectUintString(timelockDelayCv),
        },
        executor: {
            minDelayBlocks: expectUintString(executorDelayCv),
            queued: queuedEntries.filter((entry): entry is DaoQueuedExecution => Boolean(entry)),
        },
        emergency: {
            guardian: expectPrincipalString(guardianCv),
            globalPaused: expectBool(globalPausedCv),
        },
        guardrails: {
            maxSpendBps: expectUintString(guardrailsPolicy['max-spend-bps']),
            blocksPerPeriod: expectUintString(guardrailsPolicy['blocks-per-period']),
            periodLimit: expectUintString(guardrailsPolicy['period-limit']),
            currentPeriod,
            currentPeriodSpent: expectUintString(currentPeriodSpentCv),
        },
    };
}
