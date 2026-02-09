import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { AppConfig, UserSession, showConnect, disconnect } from '@stacks/connect';
import { STACKS_TESTNET, STACKS_MAINNET, type StacksNetwork } from '@stacks/network';

// App configuration
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

// Network configuration (defaulting to testnet)
const network: StacksNetwork = import.meta.env.VITE_STACKS_NETWORK === 'mainnet'
    ? STACKS_MAINNET
    : STACKS_TESTNET;

interface WalletContextType {
    isConnected: boolean;
    userAddress: string | null;
    userData: {
        profile: {
            stxAddress: {
                testnet: string;
                mainnet: string;
            };
        };
    } | null;
    network: StacksNetwork;
    connect: () => void;
    disconnect: () => void;
    isConnecting: boolean;
}

const WalletContext = createContext<WalletContextType | null>(null);

interface WalletProviderProps {
    children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [userData, setUserData] = useState<WalletContextType['userData']>(null);
    const [userAddress, setUserAddress] = useState<string | null>(null);

    // Check if user is already signed in
    useEffect(() => {
        if (userSession.isUserSignedIn()) {
            const data = userSession.loadUserData();
            setUserData(data as WalletContextType['userData']);
            setIsConnected(true);

            // Get the appropriate address based on network
            const isMainnet = import.meta.env.VITE_STACKS_NETWORK === 'mainnet';
            const address = isMainnet
                ? data.profile?.stxAddress?.mainnet
                : data.profile?.stxAddress?.testnet;
            setUserAddress(address || null);
        }
    }, []);

    const handleConnect = useCallback(() => {
        setIsConnecting(true);

        showConnect({
            appDetails: {
                name: 'DAO Factory',
                icon: window.location.origin + '/logo.svg',
            },
            redirectTo: '/',
            onFinish: () => {
                const data = userSession.loadUserData();
                setUserData(data as WalletContextType['userData']);
                setIsConnected(true);
                setIsConnecting(false);

                // Get the appropriate address based on network
                const isMainnet = import.meta.env.VITE_STACKS_NETWORK === 'mainnet';
                const address = isMainnet
                    ? data.profile?.stxAddress?.mainnet
                    : data.profile?.stxAddress?.testnet;
                setUserAddress(address || null);
            },
            onCancel: () => {
                setIsConnecting(false);
            },
            userSession,
        });
    }, []);

    const handleDisconnect = useCallback(() => {
        disconnect();
        userSession.signUserOut();
        setUserData(null);
        setUserAddress(null);
        setIsConnected(false);
    }, []);

    return (
        <WalletContext.Provider
            value={{
                isConnected,
                userAddress,
                userData,
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

export function useWallet() {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
}

// Export userSession for use in transaction signing
export { userSession, network };
