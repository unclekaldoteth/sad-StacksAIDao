import { ConnectWalletButton } from './ConnectWalletButton';
import './Header.css';

interface HeaderProps {
    daoName?: string;
    network: string;
    llmAvailable?: boolean;
    daoOptions?: { id: string; name: string }[];
    selectedDaoId?: string;
    onDaoChange?: (daoId: string) => void;
}

export function Header({
    daoName = 'Stacks AI DAO',
    network,
    llmAvailable,
    daoOptions = [],
    selectedDaoId,
    onDaoChange,
}: HeaderProps) {
    return (
        <header className="header">
            <div className="container header-inner">
                <div className="header-brand">
                    <div className="logo">
                        <span className="logo-icon">🏛️</span>
                        {daoOptions.length > 0 ? (
                            <select
                                className="dao-select"
                                value={selectedDaoId ?? ''}
                                onChange={(e) => onDaoChange?.(e.target.value)}
                                aria-label="Select DAO"
                            >
                                {selectedDaoId ? null : (
                                    <option value="" disabled>
                                        Select DAO
                                    </option>
                                )}
                                {daoOptions.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <span className="logo-text">{daoName}</span>
                        )}
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
