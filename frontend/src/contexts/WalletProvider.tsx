import { useCallback, useState, type ReactNode } from 'react';
import { WalletContext } from './wallet-context';
import { network, stacksNetworkName } from './stacks';

interface WalletProviderProps {
    children: ReactNode;
}

const CONNECT_STORAGE_KEY = '@stacks/connect';

type ConnectStorageData = {
    addresses?: {
        stx?: Array<{ address: string; symbol?: string }>;
        btc?: Array<{ address: string; symbol?: string }>;
    };
    updatedAt?: number;
    version?: string;
};

type AddressEntry = {
    address: string;
    symbol?: string;
};

function isAddressForNetwork(address: string, networkName: 'mainnet' | 'testnet'): boolean {
    const normalized = address.toUpperCase();
    if (networkName === 'mainnet') {
        return normalized.startsWith('SP') || normalized.startsWith('SM');
    }
    return normalized.startsWith('ST') || normalized.startsWith('SN');
}

function isStacksAddress(address: string): boolean {
    const normalized = address.toUpperCase();
    return (
        normalized.startsWith('SP') ||
        normalized.startsWith('SM') ||
        normalized.startsWith('ST') ||
        normalized.startsWith('SN')
    );
}

function pickPrimaryStxAddress(
    addresses: AddressEntry[],
    networkName: 'mainnet' | 'testnet'
): string | null {
    const stxCandidates = addresses.filter((entry) => {
        if (typeof entry?.address !== 'string') return false;
        if (entry.symbol?.toUpperCase() === 'STX') return true;
        return isStacksAddress(entry.address);
    });

    if (stxCandidates.length === 0) {
        return null;
    }

    const networkMatch = stxCandidates.find((entry) => isAddressForNetwork(entry.address, networkName));
    return networkMatch?.address ?? stxCandidates[0]?.address ?? null;
}

function readConnectStorage(): ConnectStorageData | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(CONNECT_STORAGE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }

        return parsed as ConnectStorageData;
    } catch {
        return null;
    }
}

function getPrimaryStxAddress(
    data: ConnectStorageData | null,
    networkName: 'mainnet' | 'testnet'
): string | null {
    return pickPrimaryStxAddress(data?.addresses?.stx ?? [], networkName);
}

export function WalletProvider({ children }: WalletProviderProps) {
    const initialConnectData = readConnectStorage();
    const initialAddress = getPrimaryStxAddress(initialConnectData, stacksNetworkName);

    const [isConnected, setIsConnected] = useState(() => Boolean(initialAddress));
    const [isConnecting, setIsConnecting] = useState(false);
    const [userAddress, setUserAddress] = useState<string | null>(() => initialAddress);

    const refreshFromStorage = useCallback(() => {
        const data = readConnectStorage();
        const address = getPrimaryStxAddress(data, stacksNetworkName);
        setUserAddress(address);
        setIsConnected(Boolean(address));
    }, []);

    const handleConnect = useCallback(async () => {
        setIsConnecting(true);

        try {
            // Lazy-load @stacks/connect to keep the initial bundle smaller.
            const { connect } = await import('@stacks/connect');

            const walletConnectProjectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ||
                '') as string;

            const options: NonNullable<Parameters<typeof connect>[0]> = {
                network: stacksNetworkName,
            };
            if (walletConnectProjectId) {
                options.walletConnectProjectId = walletConnectProjectId;
            }
            const result = await connect(options);
            const connectedAddress = pickPrimaryStxAddress(result.addresses ?? [], stacksNetworkName);

            if (connectedAddress) {
                setUserAddress(connectedAddress);
                setIsConnected(true);
                return connectedAddress;
            }

            // Fallback: @stacks/connect v8 caches addresses in localStorage.
            const data = readConnectStorage();
            const storageAddress = getPrimaryStxAddress(data, stacksNetworkName);
            setUserAddress(storageAddress);
            setIsConnected(Boolean(storageAddress));
            return storageAddress;
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            refreshFromStorage();
            return null;
        } finally {
            setIsConnecting(false);
        }
    }, [refreshFromStorage]);

    const handleDisconnect = useCallback(async () => {
        // Optimistically update UI.
        setUserAddress(null);
        setIsConnected(false);

        try {
            const { disconnect } = await import('@stacks/connect');
            disconnect();
        } catch (error) {
            console.error('Failed to disconnect wallet:', error);
        } finally {
            try {
                if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(CONNECT_STORAGE_KEY);
                }
            } catch {
                // Ignore localStorage failures (e.g. private mode restrictions).
            }
        }
    }, []);

    return (
        <WalletContext.Provider
            value={{
                isConnected,
                userAddress,
                network,
                connect: handleConnect,
                disconnect: handleDisconnect,
                isConnecting,
            }}
        >
            {children}
        </WalletContext.Provider>
    );
}
