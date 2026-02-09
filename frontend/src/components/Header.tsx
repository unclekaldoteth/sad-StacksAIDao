import { ConnectWalletButton } from './ConnectWalletButton';
import './Header.css';

interface HeaderProps {
    daoName?: string;
    network: string;
    llmAvailable?: boolean;
}

export function Header({ daoName = 'Stacks AI DAO', network, llmAvailable }: HeaderProps) {
    return (
        <header className="header">
            <div className="container header-inner">
                <div className="header-brand">
                    <div className="logo">
                        <span className="logo-icon">🏛️</span>
                        <span className="logo-text">{daoName}</span>
                    </div>
                    <span className="badge badge-info">{network}</span>
                </div>

                <div className="header-status">
                    <div className="status-item ai-status">
                        <span className={`status-dot ${llmAvailable ? 'online' : 'offline'}`}></span>
                        <span className="status-label">AI Agent</span>
                        <span className="status-value">{llmAvailable ? 'Online' : 'Offline'}</span>
                    </div>
                </div>

                <div className="header-wallet">
                    <ConnectWalletButton />
                </div>
            </div>
        </header>
    );
}
