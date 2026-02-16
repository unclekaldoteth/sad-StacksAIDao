export type DaoContracts = {
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
};

const CONTRACT_SUFFIX = '-v2';

function withSuffix(baseName: string): string {
    return `${baseName}${CONTRACT_SUFFIX}`;
}

export function buildDaoContracts(deployerAddress: string): DaoContracts {
    return {
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
    };
}

export function splitContractId(contractId: string): { contractAddress: string; contractName: string } {
    const parts = contractId.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(`Invalid contractId: "${contractId}"`);
    }
    return { contractAddress: parts[0], contractName: parts[1] };
}
