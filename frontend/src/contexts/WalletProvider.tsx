import { useCallback, useState, type ReactNode } from 'react';
import { WalletContext } from './wallet-context';
import { network, stacksNetworkName } from './stacks';

interface WalletProviderProps {
    children: ReactNode;
}

const CONNECT_STORAGE_KEY = '@stacks/connect';

type ConnectStorageData = {
    addresses?: {
        stx?: Array<{ address: string }>;
        btc?: Array<{ address: string }>;
    };
    updatedAt?: number;
    version?: string;
};

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

function getPrimaryStxAddress(data: ConnectStorageData | null): string | null {
    const address = data?.addresses?.stx?.[0]?.address;
    return typeof address === 'string' && address.length > 0 ? address : null;
}

export function WalletProvider({ children }: WalletProviderProps) {
    const initialConnectData = readConnectStorage();
    const initialAddress = getPrimaryStxAddress(initialConnectData);

    const [isConnected, setIsConnected] = useState(() => Boolean(initialAddress));
    const [isConnecting, setIsConnecting] = useState(false);
    const [userAddress, setUserAddress] = useState<string | null>(() => initialAddress);

    const refreshFromStorage = useCallback(() => {
        const data = readConnectStorage();
        const address = getPrimaryStxAddress(data);
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
            await connect(options);

            // @stacks/connect v8 caches addresses in localStorage. Read them back for state.
            refreshFromStorage();
        } catch (error) {
            console.error('Failed to connect wallet:', error);
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
