import { stacksNetworkName } from '../contexts/stacks';
import type { ClarityValue, ContractIdString, AddressString } from '@stacks/transactions';

export async function callContract(opts: {
    contract: ContractIdString;
    functionName: string;
    functionArgs?: string[] | ClarityValue[];
    address?: AddressString;
}) {
    const { request } = await import('@stacks/connect');

    return request('stx_callContract', {
        contract: opts.contract,
        functionName: opts.functionName,
        functionArgs: opts.functionArgs,
        network: stacksNetworkName,
        ...(opts.address ? { address: opts.address } : null),
    });
}

