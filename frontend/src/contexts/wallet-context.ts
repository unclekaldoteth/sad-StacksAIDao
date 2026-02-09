import { createContext } from 'react';
import type { StacksNetwork } from '@stacks/network';
import type { StacksUserData } from './stacks';

export interface WalletContextType {
    isConnected: boolean;
    userAddress: string | null;
    userData: StacksUserData | null;
    network: StacksNetwork;
    connect: () => void;
    disconnect: () => void;
    isConnecting: boolean;
}

export const WalletContext = createContext<WalletContextType | null>(null);

