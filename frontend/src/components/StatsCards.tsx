import './StatsCards.css';

interface StatsCardsProps {
    treasuryBalance: number;
    proposalCount: number;
    memberCount: number;
    healthScore?: number;
}

export function StatsCards({ treasuryBalance, proposalCount, memberCount, healthScore }: StatsCardsProps) {
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
        </div>
    );
}
