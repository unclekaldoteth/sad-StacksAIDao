export type DaoContracts = {
    daoTraits: string;
    core: string;
    proposals: string;
    voting: string;
    treasury: string;
    treasuryActions: string;
    governanceToken: string;
    membership: string;
    extensionsRegistry: string;
    templateRegistry: string;
    factory: string;
    mockProposal: string;
    testExecutor: string;
    proposalExecutor: string;
    timelockController: string;
    proposalCanceler: string;
    emergencyGuardian: string;
    governanceParams: string;
    votingStrategyModule: string;
    quorumCurve: string;
    proposalMetadata: string;
    proposalTags: string;
    treasuryGuardrails: string;
    treasuryStreaming: string;
    grantsEscrow: string;
    vestingManager: string;
    feeRebate: string;
    treasuryBudget: string;
    multisigAdapter: string;
    automationRegistry: string;
    addressBook: string;
};

export type DaoContractSet = 'v2' | 'v2-c4';

const CONTRACT_SET_SUFFIX: Record<DaoContractSet, string> = {
    v2: '-v2',
    'v2-c4': '-v2-c4',
};

const DEFAULT_CONTRACT_SET: DaoContractSet = 'v2-c4';

type BuildDaoContractsOptions = {
    contractSet?: DaoContractSet;
    coreContractName?: string;
};

function withSuffix(baseName: string, contractSet: DaoContractSet): string {
    return `${baseName}${CONTRACT_SET_SUFFIX[contractSet]}`;
}

function normalizeContractName(input: string): string {
    const parts = input.split('.');
    if (parts.length === 2 && parts[1]) {
        return parts[1];
    }
    return input;
}

export function inferDaoContractSetFromCoreContractName(coreContractName?: string | null): DaoContractSet {
    if (!coreContractName) {
        return DEFAULT_CONTRACT_SET;
    }

    const normalized = normalizeContractName(coreContractName).toLowerCase();
    if (normalized.includes('dao-core-v2-c4')) {
        return 'v2-c4';
    }
    if (normalized.includes('dao-core-v2')) {
        return 'v2';
    }

    return DEFAULT_CONTRACT_SET;
}

function resolveContractSet(options?: BuildDaoContractsOptions): DaoContractSet {
    if (options?.contractSet) {
        return options.contractSet;
    }
    return inferDaoContractSetFromCoreContractName(options?.coreContractName);
}

export function buildDaoContracts(deployerAddress: string, options?: BuildDaoContractsOptions): DaoContracts {
    const contractSet = resolveContractSet(options);
    const normalizedCoreContractName = options?.coreContractName?.trim();
    const coreContractName =
        normalizedCoreContractName ? normalizeContractName(normalizedCoreContractName) : withSuffix('dao-core', contractSet);

    return {
        daoTraits: `${deployerAddress}.${withSuffix('dao-traits', contractSet)}`,
        core: `${deployerAddress}.${coreContractName}`,
        proposals: `${deployerAddress}.${withSuffix('proposal-submission', contractSet)}`,
        voting: `${deployerAddress}.${withSuffix('proposal-voting', contractSet)}`,
        treasury: `${deployerAddress}.${withSuffix('treasury', contractSet)}`,
        treasuryActions: `${deployerAddress}.${withSuffix('treasury-actions', contractSet)}`,
        governanceToken: `${deployerAddress}.${withSuffix('governance-token', contractSet)}`,
        membership: `${deployerAddress}.${withSuffix('membership', contractSet)}`,
        extensionsRegistry: `${deployerAddress}.${withSuffix('extensions-registry', contractSet)}`,
        templateRegistry: `${deployerAddress}.${withSuffix('template-registry', contractSet)}`,
        factory: `${deployerAddress}.${withSuffix('dao-factory', contractSet)}`,
        mockProposal: `${deployerAddress}.${withSuffix('mock-proposal', contractSet)}`,
        testExecutor: `${deployerAddress}.${withSuffix('test-executor', contractSet)}`,
        proposalExecutor: `${deployerAddress}.${withSuffix('proposal-executor', contractSet)}`,
        timelockController: `${deployerAddress}.${withSuffix('timelock-controller', contractSet)}`,
        proposalCanceler: `${deployerAddress}.${withSuffix('proposal-canceler', contractSet)}`,
        emergencyGuardian: `${deployerAddress}.${withSuffix('emergency-guardian', contractSet)}`,
        governanceParams: `${deployerAddress}.${withSuffix('governance-params', contractSet)}`,
        votingStrategyModule: `${deployerAddress}.${withSuffix('voting-strategy-module', contractSet)}`,
        quorumCurve: `${deployerAddress}.${withSuffix('quorum-curve', contractSet)}`,
        proposalMetadata: `${deployerAddress}.${withSuffix('proposal-metadata', contractSet)}`,
        proposalTags: `${deployerAddress}.${withSuffix('proposal-tags', contractSet)}`,
        treasuryGuardrails: `${deployerAddress}.${withSuffix('treasury-guardrails', contractSet)}`,
        treasuryStreaming: `${deployerAddress}.${withSuffix('treasury-streaming', contractSet)}`,
        grantsEscrow: `${deployerAddress}.${withSuffix('grants-escrow', contractSet)}`,
        vestingManager: `${deployerAddress}.${withSuffix('vesting-manager', contractSet)}`,
        feeRebate: `${deployerAddress}.${withSuffix('fee-rebate', contractSet)}`,
        treasuryBudget: `${deployerAddress}.${withSuffix('treasury-budget', contractSet)}`,
        multisigAdapter: `${deployerAddress}.${withSuffix('multisig-adapter', contractSet)}`,
        automationRegistry: `${deployerAddress}.${withSuffix('automation-registry', contractSet)}`,
        addressBook: `${deployerAddress}.${withSuffix('address-book', contractSet)}`,
    };
}

export function buildDaoContractsFromCoreContractId(coreContractId: string): DaoContracts {
    const { contractAddress, contractName } = splitContractId(coreContractId);
    return buildDaoContracts(contractAddress, {
        contractSet: inferDaoContractSetFromCoreContractName(contractName),
        coreContractName: contractName,
    });
}

export function splitContractId(contractId: string): { contractAddress: string; contractName: string } {
    const parts = contractId.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(`Invalid contractId: "${contractId}"`);
    }
    return { contractAddress: parts[0], contractName: parts[1] };
}
