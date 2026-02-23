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

const CONTRACT_SUFFIX = '-v2';

function withSuffix(baseName: string): string {
    return `${baseName}${CONTRACT_SUFFIX}`;
}

export function buildDaoContracts(deployerAddress: string): DaoContracts {
    return {
        daoTraits: `${deployerAddress}.${withSuffix('dao-traits')}`,
        core: `${deployerAddress}.${withSuffix('dao-core')}`,
        proposals: `${deployerAddress}.${withSuffix('proposal-submission')}`,
        voting: `${deployerAddress}.${withSuffix('proposal-voting')}`,
        treasury: `${deployerAddress}.${withSuffix('treasury')}`,
        treasuryActions: `${deployerAddress}.${withSuffix('treasury-actions')}`,
        governanceToken: `${deployerAddress}.${withSuffix('governance-token')}`,
        membership: `${deployerAddress}.${withSuffix('membership')}`,
        extensionsRegistry: `${deployerAddress}.${withSuffix('extensions-registry')}`,
        templateRegistry: `${deployerAddress}.${withSuffix('template-registry')}`,
        factory: `${deployerAddress}.${withSuffix('dao-factory')}`,
        mockProposal: `${deployerAddress}.${withSuffix('mock-proposal')}`,
        testExecutor: `${deployerAddress}.${withSuffix('test-executor')}`,
        proposalExecutor: `${deployerAddress}.${withSuffix('proposal-executor')}`,
        timelockController: `${deployerAddress}.${withSuffix('timelock-controller')}`,
        proposalCanceler: `${deployerAddress}.${withSuffix('proposal-canceler')}`,
        emergencyGuardian: `${deployerAddress}.${withSuffix('emergency-guardian')}`,
        governanceParams: `${deployerAddress}.${withSuffix('governance-params')}`,
        votingStrategyModule: `${deployerAddress}.${withSuffix('voting-strategy-module')}`,
        quorumCurve: `${deployerAddress}.${withSuffix('quorum-curve')}`,
        proposalMetadata: `${deployerAddress}.${withSuffix('proposal-metadata')}`,
        proposalTags: `${deployerAddress}.${withSuffix('proposal-tags')}`,
        treasuryGuardrails: `${deployerAddress}.${withSuffix('treasury-guardrails')}`,
        treasuryStreaming: `${deployerAddress}.${withSuffix('treasury-streaming')}`,
        grantsEscrow: `${deployerAddress}.${withSuffix('grants-escrow')}`,
        vestingManager: `${deployerAddress}.${withSuffix('vesting-manager')}`,
        feeRebate: `${deployerAddress}.${withSuffix('fee-rebate')}`,
        treasuryBudget: `${deployerAddress}.${withSuffix('treasury-budget')}`,
        multisigAdapter: `${deployerAddress}.${withSuffix('multisig-adapter')}`,
        automationRegistry: `${deployerAddress}.${withSuffix('automation-registry')}`,
        addressBook: `${deployerAddress}.${withSuffix('address-book')}`,
    };
}

export function splitContractId(contractId: string): { contractAddress: string; contractName: string } {
    const parts = contractId.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(`Invalid contractId: "${contractId}"`);
    }
    return { contractAddress: parts[0], contractName: parts[1] };
}
