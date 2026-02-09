import './TreasuryPanel.css';
import type { DaoTreasurySpend } from '../api/client';
import { formatMicroStx, shortPrincipal } from '../utils/stx';

interface TreasuryPanelProps {
    balanceMicroStx: string;
    totalReceivedMicroStx: string;
    totalSpentMicroStx: string;
    healthScore?: number;
    recentSpends: DaoTreasurySpend[];
    recommendations?: string[];
}

export function TreasuryPanel({
    balanceMicroStx,
    totalReceivedMicroStx,
    totalSpentMicroStx,
    healthScore,
    recentSpends,
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
                    <span className="treasury-stat-value">{formatMicroStx(balanceMicroStx)} STX</span>
                </div>
                <div className="treasury-stat">
                    <span className="treasury-stat-label">Health Score</span>
                    <div className="health-indicator">
                        <div className="treasury-health-bar">
                            <div
                                className="treasury-health-fill"
                                style={{ width: `${healthScore ?? 0}%` }}
                            ></div>
                        </div>
                        <span className="health-value">
                            {typeof healthScore === 'number' ? `${healthScore}/100` : 'N/A'}
                        </span>
                    </div>
                </div>
                <div className="treasury-stat">
                    <span className="treasury-stat-label">Total Received</span>
                    <span className="treasury-stat-value">{formatMicroStx(totalReceivedMicroStx)} STX</span>
                </div>
                <div className="treasury-stat">
                    <span className="treasury-stat-label">Total Spent</span>
                    <span className="treasury-stat-value">{formatMicroStx(totalSpentMicroStx)} STX</span>
                </div>
            </div>

            <div className="treasury-transactions">
                <h4>Recent Spends</h4>
                <ul className="transaction-list">
                    {recentSpends.length === 0 && (
                        <li className="transaction empty">
                            <div className="tx-details">
                                <span className="tx-recipient">No spends recorded yet</span>
                            </div>
                        </li>
                    )}
                    {recentSpends.map((tx) => (
                        <li key={tx.spendId} className="transaction outflow">
                            <span className="tx-icon">↑</span>
                            <div className="tx-details">
                                <span className="tx-amount">
                                    -{formatMicroStx(tx.amount)} STX
                                </span>
                                <span className="tx-recipient">
                                    {shortPrincipal(tx.recipient)}
                                    {tx.proposalId ? ` (proposal #${tx.proposalId})` : ''}
                                </span>
                            </div>
                            <span className="tx-time">block {tx.spentAtBlock}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {recommendations.length > 0 && (
                <div className="treasury-recommendations">
                    <h4>AI Recommendations</h4>
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
