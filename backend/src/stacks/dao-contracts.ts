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

export function buildDaoContracts(deployerAddress: string): DaoContracts {
    return {
        core: `${deployerAddress}.dao-core`,
        proposals: `${deployerAddress}.proposal-submission`,
        voting: `${deployerAddress}.proposal-voting`,
        treasury: `${deployerAddress}.treasury`,
        treasuryActions: `${deployerAddress}.treasury-actions`,
        governanceToken: `${deployerAddress}.governance-token`,
        membership: `${deployerAddress}.membership`,
        extensionsRegistry: `${deployerAddress}.extensions-registry`,
        templateRegistry: `${deployerAddress}.template-registry`,
        factory: `${deployerAddress}.dao-factory`,
    };
}

export function splitContractId(contractId: string): { contractAddress: string; contractName: string } {
    const parts = contractId.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(`Invalid contractId: "${contractId}"`);
    }
    return { contractAddress: parts[0], contractName: parts[1] };
}

