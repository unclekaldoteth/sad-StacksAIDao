import './AIAgentCards.css';

interface AIAgentCardsProps {
    onSelectAgent?: (agent: string) => void;
}

const AI_AGENTS = [
    {
        id: 'proposal-analyzer',
        icon: '📊',
        name: 'Proposal Analyzer',
        description: 'AI-powered analysis of proposals with risk assessment and impact evaluation',
        features: ['Risk Level Detection', 'Impact Assessment', 'Key Point Extraction'],
    },
    {
        id: 'vote-recommender',
        icon: '🗳️',
        name: 'Vote Recommender',
        description: 'Smart voting recommendations based on DAO goals and historical patterns',
        features: ['Voting Suggestions', 'Confidence Scores', 'Goal Alignment'],
    },
    {
        id: 'treasury-advisor',
        icon: '💎',
        name: 'Treasury Advisor',
        description: 'Insights on treasury health, spending patterns, and runway projections',
        features: ['Health Score', 'Spending Analysis', 'Runway Projections'],
    },
    {
        id: 'risk-scanner',
        icon: '🛡️',
        name: 'Risk Scanner',
        description: 'Continuous monitoring for suspicious proposals and security threats',
        features: ['Threat Detection', 'Whale Alerts', 'Security Monitoring'],
    },
];

export function AIAgentCards({ onSelectAgent }: AIAgentCardsProps) {
    return (
        <div className="ai-agents-grid">
            {AI_AGENTS.map((agent) => (
                <div
                    key={agent.id}
                    className="ai-agent-card card"
                    onClick={() => onSelectAgent?.(agent.id)}
                >
                    <div className="agent-header">
                        <span className="agent-icon">{agent.icon}</span>
                        <h4 className="agent-name">{agent.name}</h4>
                    </div>
                    <p className="agent-description">{agent.description}</p>
                    <ul className="agent-features">
                        {agent.features.map((feature, idx) => (
                            <li key={idx}>
                                <span className="feature-dot"></span>
                                {feature}
                            </li>
                        ))}
                    </ul>
                    <div className="agent-status">
                        <span className="ai-agent-status-dot online"></span>
                        <span>Active</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
