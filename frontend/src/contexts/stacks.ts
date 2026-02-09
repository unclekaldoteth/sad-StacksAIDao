import { AppConfig, UserSession } from '@stacks/connect';
import { STACKS_MAINNET, STACKS_TESTNET, type StacksNetwork } from '@stacks/network';

const appConfig = new AppConfig(['store_write', 'publish_data']);

export const userSession = new UserSession({ appConfig });

export const isMainnet = import.meta.env.VITE_STACKS_NETWORK === 'mainnet';
export const network: StacksNetwork = isMainnet ? STACKS_MAINNET : STACKS_TESTNET;

export type StacksUserData = {
    profile?: {
        stxAddress?: {
            testnet?: string;
            mainnet?: string;
        };
    };
};

export function getUserAddress(data: StacksUserData): string | null {
    const address = isMainnet
        ? data.profile?.stxAddress?.mainnet
        : data.profile?.stxAddress?.testnet;

    return address ?? null;
}

