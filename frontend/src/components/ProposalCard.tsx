import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { DaoContracts, DaoProposal, ProposalAnalysis, VotingRecommendation } from '../api/client';
import './ProposalCard.css';
import './Modal.css';
import { formatMicroStx, shortPrincipal } from '../utils/stx';
import { useWallet } from '../contexts/useWallet';
import { callContract } from '../stacks/tx';

interface ProposalCardProps {
    proposal: DaoProposal;
    daoAddress: string;
    contracts: DaoContracts | null;
    onTransactionSuccess?: () => void;
}

export function ProposalCard({ proposal, daoAddress, contracts, onTransactionSuccess }: ProposalCardProps) {
    const { userAddress, isConnected, connect } = useWallet();
    const [analysis, setAnalysis] = useState<ProposalAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [showVoteModal, setShowVoteModal] = useState(false);
    const [voteRecommendation, setVoteRecommendation] = useState<VotingRecommendation | null>(null);
    const [votingLoading, setVotingLoading] = useState(false);
    const [voteSubmitted, setVoteSubmitted] = useState(false);
    const [voteError, setVoteError] = useState<string | null>(null);
    const [txId, setTxId] = useState<string | null>(null);
    const voteRequestIdRef = useRef(0);

    const statusColors: Record<string, string> = {
        pending: 'warning',
        active: 'info',
        passed: 'success',
        rejected: 'error',
        expired: 'secondary',
        unknown: 'secondary',
    };

    const votesFor = BigInt(proposal.votes.for);
    const votesAgainst = BigInt(proposal.votes.against);
    const totalDecisive = votesFor + votesAgainst;
    const forPercent =
        totalDecisive > 0n ? Number((votesFor * 10_000n) / totalDecisive) / 100 : 0;

    const handleAnalyze = async () => {
        setLoading(true);
        try {
            const result = await api.analyzeProposal(daoAddress, {
                id: Number(proposal.id),
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
        setTxId(null);
        const requestId = ++voteRequestIdRef.current;
        try {
            // Get AI recommendation for this vote
            const recommendation = await api.getVotingRecommendation(daoAddress, {
                id: Number(proposal.id),
                title: proposal.title,
                description: proposal.description,
                proposer: proposal.proposer,
                votesFor: Number(proposal.votes.for),
                votesAgainst: Number(proposal.votes.against),
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

    const handleVote = async (voteType: 'for' | 'against' | 'abstain') => {
        try {
            setVoteError(null);
            setVotingLoading(true);

            if (!contracts) {
                setVoteError('DAO contracts are not loaded yet.');
                return;
            }

            if (!isConnected) {
                await connect();
            }

            const VOTE_FOR = 1;
            const VOTE_AGAINST = 2;
            const VOTE_ABSTAIN = 3;
            const voteOption =
                voteType === 'for' ? VOTE_FOR : voteType === 'against' ? VOTE_AGAINST : VOTE_ABSTAIN;

            const { uintCV } = await import('@stacks/transactions');
            const res = await callContract({
                address: userAddress ?? undefined,
                contract: contracts.voting,
                functionName: 'vote',
                functionArgs: [uintCV(BigInt(proposal.id)), uintCV(voteOption)],
            });

            setTxId(res.txid ?? null);
            setVoteSubmitted(true);
            onTransactionSuccess?.();

            setTimeout(() => {
                setShowVoteModal(false);
                setVoteSubmitted(false);
                setVoteRecommendation(null);
                setVoteError(null);
                setTxId(null);
            }, 2000);
        } catch (error) {
            console.error(error);
            setVoteError(error instanceof Error ? error.message : String(error));
        } finally {
            setVotingLoading(false);
        }
    };

    const closeModal = () => {
        setShowVoteModal(false);
        setVoteRecommendation(null);
        setVoteSubmitted(false);
        setVoteError(null);
        setTxId(null);
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
                <p className="proposal-meta">
                    <span className="proposal-proposer">Proposer: {shortPrincipal(proposal.proposer)}</span>
                    <span className="proposal-blocks">Voting: {proposal.startBlock} → {proposal.endBlock}</span>
                </p>

                <div className="proposal-votes">
                    <div className="votes-bar">
                        <div className="votes-for" style={{ width: `${forPercent}%` }}></div>
                    </div>
                    <div className="votes-labels">
                        <span className="vote-for">👍 {formatMicroStx(proposal.votes.for)} STX</span>
                        <span className="vote-against">👎 {formatMicroStx(proposal.votes.against)} STX</span>
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
                                <p>Working...</p>
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
                                        disabled={votingLoading}
                                    >
                                        👍 Vote FOR
                                    </button>
                                    <button
                                        className="btn btn-error btn-large"
                                        onClick={() => handleVote('against')}
                                        disabled={votingLoading}
                                    >
                                        👎 Vote AGAINST
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-large"
                                        onClick={() => handleVote('abstain')}
                                        disabled={votingLoading}
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
                                {txId && (
                                    <p className="txid">
                                        Tx: <code>{shortPrincipal(txId)}</code>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
