import './TreasuryPanel.css';

interface TreasuryPanelProps {
    balance: number;
    healthScore: number;
    recentTransactions: {
        amount: number;
        recipient: string;
        type: 'inflow' | 'outflow';
        timestamp: string;
    }[];
    recommendations?: string[];
}

export function TreasuryPanel({
    balance,
    healthScore,
    recentTransactions,
    recommendations = []
}: TreasuryPanelProps) {
    return (
        <div className="treasury-panel card">
            <div className="treasury-header">
                <div className="treasury-title">
                    <span className="treasury-icon">🏦</span>
                    <h3>Treasury Advisor</h3>
                </div>
                <span className="badge badge-success">AI Monitoring</span>
            </div>

            <div className="treasury-stats">
                <div className="treasury-stat">
                    <span className="treasury-stat-label">Total Balance</span>
                    <span className="treasury-stat-value">{balance.toLocaleString()} STX</span>
                </div>
                <div className="treasury-stat">
                    <span className="treasury-stat-label">Health Score</span>
                    <div className="health-indicator">
                        <div className="treasury-health-bar">
                            <div
                                className="treasury-health-fill"
                                style={{ width: `${healthScore}%` }}
                            ></div>
                        </div>
                        <span className="health-value">{healthScore}/100</span>
                    </div>
                </div>
            </div>

            <div className="treasury-transactions">
                <h4>Recent Activity</h4>
                <ul className="transaction-list">
                    {recentTransactions.map((tx, idx) => (
                        <li key={idx} className={`transaction ${tx.type}`}>
                            <span className="tx-icon">{tx.type === 'inflow' ? '↓' : '↑'}</span>
                            <div className="tx-details">
                                <span className="tx-amount">
                                    {tx.type === 'inflow' ? '+' : '-'}{tx.amount} STX
                                </span>
                                <span className="tx-recipient">{tx.recipient}</span>
                            </div>
                            <span className="tx-time">{tx.timestamp}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {recommendations.length > 0 && (
                <div className="treasury-recommendations">
                    <h4>🤖 AI Recommendations</h4>
                    <ul>
                        {recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
