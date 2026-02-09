import { useEffect, useRef, useState } from 'react';
import type { DaoContracts } from '../api/client';
import { useWallet } from '../contexts/useWallet';
import { callContract } from '../stacks/tx';
import { shortPrincipal } from '../utils/stx';
import './Modal.css';
import './CreateProposalModal.css';

interface CreateProposalModalProps {
    open: boolean;
    daoAddress: string;
    contracts: DaoContracts | null;
    onClose: () => void;
    onCreated: () => void;
}

export function CreateProposalModal({
    open,
    daoAddress,
    contracts,
    onClose,
    onCreated,
}: CreateProposalModalProps) {
    const { userAddress, isConnected, connect } = useWallet();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [proposalContract, setProposalContract] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txId, setTxId] = useState<string | null>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setError(null);
        setTxId(null);
        // Autofocus title for keyboard flows.
        setTimeout(() => titleInputRef.current?.focus(), 0);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setTxId(null);

        if (!contracts) {
            setError('DAO contracts are not loaded yet.');
            return;
        }

        if (!title.trim() || !description.trim()) {
            setError('Title and description are required.');
            return;
        }

        setSubmitting(true);
        try {
            if (!isConnected) {
                await connect();
            }

            const {
                noneCV,
                principalCV,
                someCV,
                stringAsciiCV,
                stringUtf8CV,
            } = await import('@stacks/transactions');

            const proposalContractArg = proposalContract.trim()
                ? someCV(principalCV(proposalContract.trim()))
                : noneCV();

            const res = await callContract({
                address: userAddress ?? undefined,
                contract: contracts.proposals,
                functionName: 'propose',
                functionArgs: [
                    stringAsciiCV(title.trim()),
                    stringUtf8CV(description.trim()),
                    proposalContractArg,
                ],
            });

            setTxId(res.txid ?? null);
            onCreated();

            setTimeout(() => {
                onClose();
                setTitle('');
                setDescription('');
                setProposalContract('');
            }, 1200);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div className="modal-content proposal-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose} aria-label="Close">
                    ×
                </button>

                <h3>Create Proposal</h3>
                <p className="modal-subtitle">
                    DAO: <code>{shortPrincipal(daoAddress)}</code>
                </p>

                <form className="proposal-form" onSubmit={handleSubmit}>
                    <label className="form-field">
                        <span className="form-label">Title</span>
                        <input
                            ref={titleInputRef}
                            className="input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={128}
                            placeholder="Short, ASCII-only title"
                            disabled={submitting}
                        />
                    </label>

                    <label className="form-field">
                        <span className="form-label">Description</span>
                        <textarea
                            className="input textarea"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={1024}
                            placeholder="Explain what you want to change and why"
                            disabled={submitting}
                            rows={6}
                        />
                    </label>

                    <label className="form-field">
                        <span className="form-label">
                            Proposal Contract (Optional)
                        </span>
                        <input
                            className="input"
                            value={proposalContract}
                            onChange={(e) => setProposalContract(e.target.value)}
                            placeholder="ST...contract-name"
                            disabled={submitting}
                        />
                    </label>

                    {error && <div className="form-error">{error}</div>}
                    {txId && (
                        <div className="form-success">
                            Submitted: <code>{shortPrincipal(txId)}</code>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? 'Submitting...' : 'Submit Proposal'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

