import './StatsCards.css';

interface StatsCardsProps {
    treasuryBalance: number;
    proposalCount: number;
    memberCount: number;
    healthScore?: number;
    tokenBalance?: number;
    riskScore?: number;
}

export function StatsCards({
    treasuryBalance,
    proposalCount,
    memberCount,
    healthScore,
    tokenBalance = 0,
    riskScore = 92
}: StatsCardsProps) {
    const getRiskColor = (score: number) => {
        if (score >= 80) return 'low';
        if (score >= 50) return 'medium';
        return 'high';
    };

    return (
        <div className="stats-grid">
            <div className="stat-card">
                <div className="stat-icon">💎</div>
                <div className="stat-info">
                    <span className="stat-label">Treasury Balance</span>
                    <span className="stat-value">{treasuryBalance.toLocaleString()} STX</span>
                </div>
            </div>

            <div className="stat-card">
                <div className="stat-icon">📜</div>
                <div className="stat-info">
                    <span className="stat-label">Active Proposals</span>
                    <span className="stat-value">{proposalCount}</span>
                </div>
            </div>

            <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                    <span className="stat-label">Members</span>
                    <span className="stat-value">{memberCount}</span>
                </div>
            </div>

            <div className="stat-card">
                <div className="stat-icon">🪙</div>
                <div className="stat-info">
                    <span className="stat-label">Your Token Balance</span>
                    <span className="stat-value">{tokenBalance.toLocaleString()} SADAO</span>
                </div>
            </div>

            <div className="stat-card">
                <div className="stat-icon">❤️</div>
                <div className="stat-info">
                    <span className="stat-label">Health Score</span>
                    <div className="health-bar">
                        <div
                            className="health-fill"
                            style={{ width: `${healthScore ?? 0}%` }}
                        ></div>
                    </div>
                    <span className="stat-value">{healthScore ?? 0}/100</span>
                </div>
            </div>

            <div className="stat-card">
                <div className="stat-icon">🛡️</div>
                <div className="stat-info">
                    <span className="stat-label">Risk Score</span>
                    <span className={`stat-value risk-${getRiskColor(riskScore)}`}>
                        {riskScore}/100 ({getRiskColor(riskScore)} risk)
                    </span>
                </div>
            </div>
        </div>
    );
}
