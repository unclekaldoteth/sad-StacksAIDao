import { useWallet } from '../contexts/useWallet';
import './ConnectWalletButton.css';

export function ConnectWalletButton() {
    const { isConnected, userAddress, connect, disconnect, isConnecting } = useWallet();

    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    if (isConnected && userAddress) {
        return (
            <div className="wallet-connected">
                <div className="wallet-info">
                    <span className="wallet-indicator"></span>
                    <span className="wallet-address">{formatAddress(userAddress)}</span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={disconnect}>
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button
            className="btn btn-primary connect-wallet-btn"
            onClick={connect}
            disabled={isConnecting}
        >
            {isConnecting ? (
                <>
                    <span className="loader loader-sm"></span>
                    Connecting...
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
