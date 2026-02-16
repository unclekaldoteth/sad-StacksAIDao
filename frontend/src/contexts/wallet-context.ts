import { createContext } from 'react';
import type { StacksNetwork } from '@stacks/network';

export interface WalletContextType {
    isConnected: boolean;
    userAddress: string | null;
    network: StacksNetwork;
    connect: () => Promise<string | null>;
    disconnect: () => Promise<void>;
    isConnecting: boolean;
}

export const WalletContext = createContext<WalletContextType | null>(null);
