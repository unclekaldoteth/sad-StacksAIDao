import { cvToHex, hexToCV, type ClarityValue } from '@stacks/transactions';
import { config } from '../config/index.js';
import { splitContractId } from './dao-contracts.js';

type CallReadOnlyResponse =
    | {
          okay: true;
          result: string;
      }
    | {
          okay: false;
          cause?: string;
          message?: string;
          result?: string;
      };

function isCallReadOnlyResponse(value: unknown): value is CallReadOnlyResponse {
    if (!value || typeof value !== 'object') {
        return false;
    }
    if (!('okay' in value)) {
        return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof (value as any).okay === 'boolean';
}

export async function callReadOnlyFunction(opts: {
    contractId: string;
    functionName: string;
    senderAddress: string;
    args?: ClarityValue[];
    apiUrl?: string;
}): Promise<ClarityValue> {
    const { contractAddress, contractName } = splitContractId(opts.contractId);
    const apiUrl = opts.apiUrl ?? config.stacks.apiUrl;
    const url = `${apiUrl}/v2/contracts/call-read/${contractAddress}/${contractName}/${opts.functionName}`;

    const body = {
        sender: opts.senderAddress,
        arguments: (opts.args ?? []).map(cvToHex),
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(
            `Stacks API call-read failed (${res.status} ${res.statusText}): ${text || url}`
        );
    }

    const json = (await res.json().catch(() => null)) as unknown;
    if (!isCallReadOnlyResponse(json)) {
        throw new Error(`Unexpected call-read response: ${JSON.stringify(json)}`);
    }

    if (!json.okay) {
        throw new Error(
            `Stacks call-read returned okay=false: ${json.cause || json.message || 'Unknown error'}`
        );
    }

    if (typeof json.result !== 'string' || !json.result.startsWith('0x')) {
        throw new Error(`Stacks call-read missing/invalid result: ${JSON.stringify(json)}`);
    }

    return hexToCV(json.result);
}
