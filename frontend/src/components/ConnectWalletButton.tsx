import { useWallet } from '../contexts/useWallet';
import './ConnectWalletButton.css';

export function ConnectWalletButton() {
    const { isConnected, userAddress, connect, disconnect, isConnecting } = useWallet();

    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const handleClick = () => {
        if (isConnected) {
            void disconnect();
        } else {
            void connect();
        }
    };

    return (
        <button
            className={`btn connect-wallet-btn ${isConnected ? 'connected' : 'btn-primary'}`}
            onClick={handleClick}
            disabled={isConnecting}
            title={isConnected ? 'Click to disconnect' : 'Connect your Stacks wallet'}
        >
            {isConnecting ? (
                <>
                    <span className="loader loader-sm"></span>
                    Connecting...
                </>
            ) : isConnected && userAddress ? (
                <>
                    <span className="wallet-indicator"></span>
                    {formatAddress(userAddress)}
                </>
            ) : (
                <>
                    <span className="wallet-icon">🔗</span>
                    Connect Wallet
                </>
            )}
        </button>
    );
}
