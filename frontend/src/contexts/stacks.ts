import { STACKS_MAINNET, STACKS_TESTNET, type StacksNetwork } from '@stacks/network';

const rawNetwork = String(import.meta.env.VITE_STACKS_NETWORK || '').toLowerCase();

if (rawNetwork && rawNetwork !== 'mainnet' && rawNetwork !== 'testnet') {
    // Keep behavior predictable if env is misconfigured.
    console.warn(`[wallet] Unknown VITE_STACKS_NETWORK="${rawNetwork}", defaulting to "testnet"`);
}

export const stacksNetworkName: 'mainnet' | 'testnet' =
    rawNetwork === 'mainnet' ? 'mainnet' : 'testnet';
export const isMainnet = stacksNetworkName === 'mainnet';
export const network: StacksNetwork = isMainnet ? STACKS_MAINNET : STACKS_TESTNET;
