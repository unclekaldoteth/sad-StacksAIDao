import { uintCV } from '@stacks/transactions';
import { config } from '../config/index.js';
import {
    buildDaoContracts,
    buildDaoContractsFromCoreContractId,
    splitContractId,
    type DaoContracts,
} from '../stacks/dao-contracts.js';
import { expectPrincipalString, expectString, expectTuple, expectUintString, unwrapOptional } from '../stacks/clarity.js';
import { callReadOnlyFunction } from '../stacks/read-only.js';

export type DaoRegistryEntry = {
    daoId: string;
    name: string;
    coreContractId: string;
    contractAddress: string;
    registeredBy: string;
    deployedAtBlock: string;
    templateId: string;
    network: string;
    stacksApiUrl: string;
    contracts: DaoContracts;
};

export type DaoRegistryResponse = {
    factoryContractId: string | null;
    defaultDaoId: string | null;
    daos: DaoRegistryEntry[];
};

export type DaoContext = {
    network: string;
    stacksApiUrl: string;
    deployerAddress: string;
    contracts: DaoContracts;
    daoId?: string;
    name?: string;
};

const CACHE_TTL_MS = 30_000;

let cache:
    | {
          factoryContractId: string;
          fetchedAt: number;
          daos: DaoRegistryEntry[];
      }
    | null = null;

function getFactoryContractId(): string | null {
    const envValue = process.env.DAO_FACTORY_CONTRACT_ID?.trim();
    if (envValue) {
        return envValue;
    }
    if (config.stacks.daoDeployer) {
        return buildDaoContracts(config.stacks.daoDeployer).factory;
    }
    return null;
}

function getDefaultDaoIdEnv(): string | null {
    const envValue = process.env.DAO_DEFAULT_ID?.trim();
    return envValue || null;
}

function getCallReadOnlySender(factoryContractId: string): string {
    if (config.stacks.daoDeployer) {
        return config.stacks.daoDeployer;
    }
    // Use the factory contract address as a safe fallback sender.
    return splitContractId(factoryContractId).contractAddress;
}

async function fetchDaoCount(factoryContractId: string): Promise<bigint> {
    const senderAddress = getCallReadOnlySender(factoryContractId);
    const cv = await callReadOnlyFunction({
        contractId: factoryContractId,
        functionName: 'get-dao-count',
        senderAddress,
        apiUrl: config.stacks.apiUrl,
    });
    return BigInt(expectUintString(cv));
}

async function fetchDaoInfo(factoryContractId: string, daoId: bigint): Promise<DaoRegistryEntry | null> {
    const senderAddress = getCallReadOnlySender(factoryContractId);
    const cv = await callReadOnlyFunction({
        contractId: factoryContractId,
        functionName: 'get-dao-info',
        senderAddress,
        args: [uintCV(daoId)],
        apiUrl: config.stacks.apiUrl,
    });

    const tupleCv = unwrapOptional(cv);
    if (!tupleCv) {
        return null;
    }

    const info = expectTuple(tupleCv);
    const name = expectString(info.name);
    const coreContractId = expectPrincipalString(info['core-contract']);
    const { contractAddress } = splitContractId(coreContractId);
    const registeredBy = expectPrincipalString(info.deployer);
    const deployedAtBlock = expectUintString(info['deployed-at']);
    const templateId = expectUintString(info['template-id']);

    return {
        daoId: daoId.toString(),
        name,
        coreContractId,
        contractAddress,
        registeredBy,
        deployedAtBlock,
        templateId,
        network: config.stacks.network,
        stacksApiUrl: config.stacks.apiUrl,
        contracts: buildDaoContractsFromCoreContractId(coreContractId),
    };
}

export async function listDaos(opts?: { limit?: number }): Promise<DaoRegistryResponse> {
    const factoryContractId = getFactoryContractId();
    if (!factoryContractId) {
        return {
            factoryContractId: null,
            defaultDaoId: null,
            daos: [],
        };
    }

    const now = Date.now();
    if (cache && cache.factoryContractId === factoryContractId && now - cache.fetchedAt < CACHE_TTL_MS) {
        const defaultFromEnv = getDefaultDaoIdEnv();
        const defaultDaoId =
            defaultFromEnv && cache.daos.some((d) => d.daoId === defaultFromEnv)
                ? defaultFromEnv
                : cache.daos.length > 0
                    ? cache.daos[cache.daos.length - 1]!.daoId
                    : null;
        return {
            factoryContractId,
            defaultDaoId,
            daos: cache.daos,
        };
    }

    const count = await fetchDaoCount(factoryContractId);
    const limit = typeof opts?.limit === 'number' && opts.limit > 0 ? BigInt(opts.limit) : 50n;
    const start = count > limit ? count - limit + 1n : 1n;

    const ids: bigint[] = [];
    for (let i = start; i <= count; i += 1n) {
        ids.push(i);
    }

    const results = await Promise.all(ids.map((id) => fetchDaoInfo(factoryContractId, id)));
    const daos = results.filter((d): d is DaoRegistryEntry => Boolean(d));
    daos.sort((a, b) => BigInt(a.daoId) < BigInt(b.daoId) ? -1 : 1);

    cache = {
        factoryContractId,
        fetchedAt: now,
        daos,
    };

    const defaultFromEnv = getDefaultDaoIdEnv();
    const defaultDaoId =
        defaultFromEnv && daos.some((d) => d.daoId === defaultFromEnv)
            ? defaultFromEnv
            : daos.length > 0
                ? daos[daos.length - 1]!.daoId
                : null;

    return {
        factoryContractId,
        defaultDaoId,
        daos,
    };
}

export async function getDaoById(daoId: string): Promise<DaoRegistryEntry | null> {
    const factoryContractId = getFactoryContractId();
    if (!factoryContractId) {
        return null;
    }
    if (!/^\d+$/.test(daoId)) {
        return null;
    }
    return fetchDaoInfo(factoryContractId, BigInt(daoId));
}

export function buildDaoContextFromCoreContract(coreContractId: string): DaoContext {
    const { contractAddress } = splitContractId(coreContractId);
    return {
        network: config.stacks.network,
        stacksApiUrl: config.stacks.apiUrl,
        deployerAddress: contractAddress,
        contracts: buildDaoContractsFromCoreContractId(coreContractId),
        name: coreContractId,
    };
}

export async function resolveDaoContext(opts?: {
    daoId?: string;
    coreContractId?: string;
}): Promise<DaoContext> {
    if (opts?.daoId) {
        const found = await getDaoById(opts.daoId);
        if (found) {
            return {
                network: found.network,
                stacksApiUrl: found.stacksApiUrl,
                deployerAddress: found.contractAddress,
                contracts: found.contracts,
                daoId: found.daoId,
                name: found.name,
            };
        }
        throw new Error(`Unknown DAO id: ${opts.daoId}`);
    }

    if (opts?.coreContractId) {
        return buildDaoContextFromCoreContract(opts.coreContractId);
    }

    try {
        const registry = await listDaos({ limit: 1 });
        if (registry.defaultDaoId) {
            const found = await getDaoById(registry.defaultDaoId);
            if (found) {
                return {
                    network: found.network,
                    stacksApiUrl: found.stacksApiUrl,
                    deployerAddress: found.contractAddress,
                    contracts: found.contracts,
                    daoId: found.daoId,
                    name: found.name,
                };
            }
        }
    } catch (error) {
        // Keep the API usable if factory registry reads fail temporarily.
        if (!config.stacks.daoDeployer) {
            throw error;
        }
        console.warn(`[dao-registry] Failed to load DAO registry. Falling back to DAO_DEPLOYER_ADDRESS. ${String(error)}`);
    }

    // Fall back to legacy single-DAO configuration.
    const deployerAddress = config.stacks.daoDeployer;
    if (!deployerAddress) {
        throw new Error('DAO_DEPLOYER_ADDRESS is not configured and no DAO registry is available');
    }
    return {
        network: config.stacks.network,
        stacksApiUrl: config.stacks.apiUrl,
        deployerAddress,
        contracts: buildDaoContracts(deployerAddress),
        name: 'default',
    };
}
