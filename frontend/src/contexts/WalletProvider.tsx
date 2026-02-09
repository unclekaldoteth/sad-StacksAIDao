import { useCallback, useState, type ReactNode } from 'react';
import { showConnect, disconnect } from '@stacks/connect';
import { WalletContext } from './wallet-context';
import { getUserAddress, network, type StacksUserData, userSession } from './stacks';

interface WalletProviderProps {
    children: ReactNode;
}

function loadInitialUserData(): StacksUserData | null {
    if (!userSession.isUserSignedIn()) {
        return null;
    }
    return userSession.loadUserData() as StacksUserData;
}

export function WalletProvider({ children }: WalletProviderProps) {
    const initialUserData = loadInitialUserData();
    const initialAddress = initialUserData ? getUserAddress(initialUserData) : null;

    const [isConnected, setIsConnected] = useState(() => Boolean(initialUserData));
    const [isConnecting, setIsConnecting] = useState(false);
    const [userData, setUserData] = useState<StacksUserData | null>(() => initialUserData);
    const [userAddress, setUserAddress] = useState<string | null>(() => initialAddress);

    const handleConnect = useCallback(() => {
        setIsConnecting(true);

        showConnect({
            appDetails: {
                name: 'DAO Factory',
                // Keep this pointing at an existing public asset to avoid broken icons.
                icon: window.location.origin + '/vite.svg',
            },
            redirectTo: '/',
            onFinish: () => {
                const data = userSession.loadUserData() as StacksUserData;
                setUserData(data);
                setIsConnected(true);
                setIsConnecting(false);
                setUserAddress(getUserAddress(data));
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

