import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { ProposalAnalysis, VotingRecommendation } from '../api/client';
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
    const [showVoteModal, setShowVoteModal] = useState(false);
    const [voteRecommendation, setVoteRecommendation] = useState<VotingRecommendation | null>(null);
    const [votingLoading, setVotingLoading] = useState(false);
    const [voteSubmitted, setVoteSubmitted] = useState(false);
    const [voteError, setVoteError] = useState<string | null>(null);
    const voteRequestIdRef = useRef(0);

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

    const handleVoteClick = async () => {
        setShowVoteModal(true);
        setVotingLoading(true);
        setVoteError(null);
        setVoteRecommendation(null);
        setVoteSubmitted(false);
        const requestId = ++voteRequestIdRef.current;
        try {
            // Get AI recommendation for this vote
            const recommendation = await api.getVotingRecommendation(daoAddress, {
                id: proposal.id,
                title: proposal.title,
                description: proposal.description,
                proposer: proposal.proposer,
                votesFor: proposal.votesFor,
                votesAgainst: proposal.votesAgainst,
            });
            if (requestId !== voteRequestIdRef.current) {
                return;
            }
            setVoteRecommendation(recommendation);
        } catch (error) {
            console.error('Failed to get recommendation:', error);
            if (requestId !== voteRequestIdRef.current) {
                return;
            }
            setVoteError('Failed to get AI recommendation. Please try again.');
        } finally {
            if (requestId === voteRequestIdRef.current) {
                setVotingLoading(false);
            }
        }
    };

    const handleVote = (voteType: 'for' | 'against' | 'abstain') => {
        // In a real app, this would call a smart contract
        console.log(`Voting ${voteType} on proposal #${proposal.id}`);
        setVoteSubmitted(true);
        setTimeout(() => {
            setShowVoteModal(false);
            setVoteSubmitted(false);
            setVoteRecommendation(null);
            setVoteError(null);
        }, 2000);
    };

    const closeModal = () => {
        setShowVoteModal(false);
        setVoteRecommendation(null);
        setVoteSubmitted(false);
        setVoteError(null);
        voteRequestIdRef.current += 1; // invalidate any in-flight request
    };

    useEffect(() => {
        if (!showVoteModal) {
            return;
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showVoteModal]);

    return (
        <>
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
                    <button
                        className="btn btn-primary"
                        onClick={handleVoteClick}
                        disabled={proposal.status !== 'active'}
                    >
                        Vote
                    </button>
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

            {/* Vote Modal */}
            {showVoteModal && (
                <div className="modal-overlay" onClick={closeModal} role="dialog" aria-modal="true">
                    <div className="modal-content vote-modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={closeModal}>×</button>

                        <h3>Vote on Proposal #{proposal.id}</h3>
                        <p className="modal-proposal-title">{proposal.title}</p>

                        {votingLoading && (
                            <div className="vote-loading">
                                <span className="loader"></span>
                                <p>Getting AI recommendation...</p>
                            </div>
                        )}

                        {voteRecommendation && !voteSubmitted && (
                            <div className="vote-recommendation fade-in">
                                <div className="recommendation-header">
                                    <span className="recommendation-label">🤖 AI Recommends:</span>
                                    <span className={`badge badge-${voteRecommendation.vote === 'for' ? 'success' : voteRecommendation.vote === 'against' ? 'error' : 'warning'}`}>
                                        Vote {voteRecommendation.vote.toUpperCase()}
                                    </span>
                                    <span className="confidence">
                                        {voteRecommendation.confidence}% confidence
                                    </span>
                                </div>
                                <p className="recommendation-reasoning">{voteRecommendation.reasoning}</p>

                                <div className="vote-buttons">
                                    <button
                                        className="btn btn-success btn-large"
                                        onClick={() => handleVote('for')}
                                    >
                                        👍 Vote FOR
                                    </button>
                                    <button
                                        className="btn btn-error btn-large"
                                        onClick={() => handleVote('against')}
                                    >
                                        👎 Vote AGAINST
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-large"
                                        onClick={() => handleVote('abstain')}
                                    >
                                        🤷 Abstain
                                    </button>
                                </div>
                            </div>
                        )}

                        {voteError && !votingLoading && !voteSubmitted && (
                            <div className="vote-error fade-in">
                                <p>{voteError}</p>
                                <button className="btn btn-secondary" onClick={handleVoteClick}>
                                    Retry
                                </button>
                            </div>
                        )}

                        {voteSubmitted && (
                            <div className="vote-success fade-in">
                                <span className="success-icon">✅</span>
                                <p>Vote submitted successfully!</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
