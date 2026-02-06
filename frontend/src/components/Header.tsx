import './Header.css';

interface HeaderProps {
    daoAddress: string;
    network: string;
    llmProvider?: string;
    llmAvailable?: boolean;
}

export function Header({ daoAddress, network, llmProvider, llmAvailable }: HeaderProps) {
    const shortAddress = `${daoAddress.slice(0, 6)}...${daoAddress.slice(-4)}`;

    return (
        <header className="header">
            <div className="container header-inner">
                <div className="header-brand">
                    <div className="logo">
                        <span className="logo-icon">🏛️</span>
                        <span className="logo-text">DAO Factory</span>
                    </div>
                    <span className="badge badge-info">{network}</span>
                </div>

                <div className="header-status">
                    <div className="status-item">
                        <span className="status-label">AI Agent</span>
                        <span className={`status-dot ${llmAvailable ? 'online' : 'offline'}`}></span>
                        <span className="status-value">{llmProvider || 'Unknown'}</span>
                    </div>
                    <div className="status-item">
                        <span className="status-label">DAO</span>
                        <code className="status-address">{shortAddress}</code>
                    </div>
                </div>
            </div>
        </header>
    );
}
