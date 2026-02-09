import { useMemo } from 'react';
import './AlertsPanel.css';
import type { DaoAlert, DaoAlertLevel } from '../api/client';

function levelRank(level: DaoAlertLevel): number {
    switch (level) {
        case 'critical':
            return 0;
        case 'warning':
            return 1;
        case 'info':
            return 2;
        default:
            return 3;
    }
}

function riskLabel(score: number): { label: string; badgeClass: string } {
    if (score >= 70) return { label: 'High', badgeClass: 'badge-error' };
    if (score >= 35) return { label: 'Medium', badgeClass: 'badge-warning' };
    return { label: 'Low', badgeClass: 'badge-success' };
}

export function AlertsPanel({
    riskScore,
    alerts,
    generatedAt,
}: {
    riskScore: number;
    alerts: DaoAlert[];
    generatedAt?: string;
}) {
    const sortedAlerts = useMemo(() => {
        return alerts
            .slice()
            .sort((a, b) => levelRank(a.level) - levelRank(b.level));
    }, [alerts]);

    const risk = riskLabel(riskScore);
    const timestamp = generatedAt ? new Date(generatedAt) : null;

    return (
        <div className="alerts-panel card">
            <div className="alerts-header">
                <div>
                    <h3 className="alerts-title">Risk Scanner</h3>
                    <p className="alerts-subtitle">
                        Heuristic alerts from on-chain proposals and treasury activity
                        {timestamp ? ` • Last scan: ${timestamp.toLocaleString()}` : ''}
                    </p>
                </div>
                <div className="alerts-risk">
                    <span className={`badge ${risk.badgeClass}`}>{risk.label} Risk</span>
                    <div className="risk-score">{riskScore}/100</div>
                </div>
            </div>

            <div className="risk-meter">
                <div className="risk-meter-track" />
                <div
                    className="risk-meter-fill"
                    style={{ width: `${Math.max(0, Math.min(100, riskScore))}%` }}
                />
            </div>

            {sortedAlerts.length === 0 ? (
                <div className="alerts-empty">
                    <span className="badge badge-success">All Clear</span>
                    <p>No alerts detected in the scanned window.</p>
                </div>
            ) : (
                <ul className="alerts-list">
                    {sortedAlerts.slice(0, 8).map((a) => (
                        <li key={a.id} className={`alert-item alert-${a.level}`}>
                            <div className="alert-top">
                                <span className={`badge alert-badge badge-${a.level === 'critical' ? 'error' : a.level}`}>
                                    {a.level}
                                </span>
                                <span className="alert-title">{a.title}</span>
                            </div>
                            <div className="alert-message">{a.message}</div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

