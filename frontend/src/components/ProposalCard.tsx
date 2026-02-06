import { useState } from 'react';
import { api } from '../api/client';
import type { ProposalAnalysis } from '../api/client';
import './ProposalCard.css';

interface Proposal {
    id: number;
    title: string;
    description: string;
    proposer: string;
    status: 'pending' | 'active' | 'passed' | 'rejected';
    votesFor: number;
    votesAgainst: number;
}

interface ProposalCardProps {
    proposal: Proposal;
    daoAddress: string;
}

export function ProposalCard({ proposal, daoAddress }: ProposalCardProps) {
    const [analysis, setAnalysis] = useState<ProposalAnalysis | null>(null);
    const [loading, setLoading] = useState(false);

    const statusColors: Record<string, string> = {
        pending: 'warning',
        active: 'info',
        passed: 'success',
        rejected: 'error',
    };

    const totalVotes = proposal.votesFor + proposal.votesAgainst;
    const forPercent = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;

    const handleAnalyze = async () => {
        setLoading(true);
        try {
            const result = await api.analyzeProposal(daoAddress, {
                id: proposal.id,
                title: proposal.title,
                description: proposal.description,
                proposer: proposal.proposer,
            });
            setAnalysis(result);
        } catch (error) {
            console.error('Analysis failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="proposal-card card">
            <div className="proposal-header">
                <span className="proposal-id">#{proposal.id}</span>
                <span className={`badge badge-${statusColors[proposal.status]}`}>
                    {proposal.status}
                </span>
            </div>

            <h4 className="proposal-title">{proposal.title}</h4>
            <p className="proposal-description">{proposal.description}</p>

            <div className="proposal-votes">
                <div className="votes-bar">
                    <div className="votes-for" style={{ width: `${forPercent}%` }}></div>
                </div>
                <div className="votes-labels">
                    <span className="vote-for">👍 {proposal.votesFor}</span>
                    <span className="vote-against">👎 {proposal.votesAgainst}</span>
                </div>
            </div>

            <div className="proposal-actions">
                <button
                    className="btn btn-secondary"
                    onClick={handleAnalyze}
                    disabled={loading}
                >
                    {loading ? <span className="loader"></span> : '🤖 AI Analysis'}
                </button>
                <button className="btn btn-primary">Vote</button>
            </div>

            {analysis && (
                <div className="analysis-result fade-in">
                    <div className="analysis-header">
                        <h5>AI Analysis</h5>
                        <span className={`badge badge-${analysis.riskLevel === 'low' ? 'success' :
                            analysis.riskLevel === 'medium' ? 'warning' : 'error'
                            }`}>
                            {analysis.riskLevel} risk
                        </span>
                    </div>
                    <p className="analysis-summary">{analysis.summary}</p>
                    <div className="analysis-recommendation">
                        <strong>Recommendation:</strong> {analysis.recommendation}
                    </div>
                    {analysis.keyPoints.length > 0 && (
                        <ul className="analysis-points">
                            {analysis.keyPoints.map((point, idx) => (
                                <li key={idx}>{point}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
