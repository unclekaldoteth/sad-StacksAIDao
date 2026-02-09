import './StatsCards.css';

interface StatsCardsProps {
    treasuryBalanceStx: string;
    proposalCount: number;
    memberCount: number;
    healthScore?: number;
    riskScore?: number;
    alertCount?: number;
    userVotingPowerStx: string | null;
    userAddress: string | null;
}

export function StatsCards({
    treasuryBalanceStx,
    proposalCount,
    memberCount,
    healthScore,
    riskScore,
    alertCount,
    userVotingPowerStx,
    userAddress
}: StatsCardsProps) {
    return (
        <div className="stats-grid">
            <div className="stat-card">
                <div className="stat-icon">💎</div>
                <div className="stat-info">
                    <span className="stat-label">Treasury Balance</span>
                    <span className="stat-value">{treasuryBalanceStx} STX</span>
                </div>
            </div>

            <div className="stat-card">
                <div className="stat-icon">📜</div>
                <div className="stat-info">
                    <span className="stat-label">Proposals</span>
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
                <div className="stat-icon">⚡</div>
                <div className="stat-info">
                    <span className="stat-label">Your Voting Power</span>
                    <span className="stat-value">
                        {userAddress ? (
                            userVotingPowerStx ? `${userVotingPowerStx} STX` : 'Loading...'
                        ) : (
                            'Connect wallet'
                        )}
                    </span>
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
                    <span className="stat-label">
                        Risk Score{typeof alertCount === 'number' ? ` (${alertCount} alerts)` : ''}
                    </span>
                    <div className="health-bar">
                        <div
                            className="risk-fill"
                            style={{ width: `${riskScore ?? 0}%` }}
                        ></div>
                    </div>
                    <span className="stat-value">{riskScore ?? 0}/100</span>
                </div>
            </div>
        </div>
    );
}
