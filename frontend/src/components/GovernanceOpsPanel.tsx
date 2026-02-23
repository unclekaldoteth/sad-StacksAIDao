import { useEffect, useMemo, useState } from 'react';
import type { DaoContracts, DaoOperationsResponse } from '../api/client';
import { useWallet } from '../contexts/useWallet';
import { callContract } from '../stacks/tx';
import './GovernanceOpsPanel.css';

interface GovernanceOpsPanelProps {
    contracts: DaoContracts | null;
    operations: DaoOperationsResponse | null;
    onRefresh: () => void;
}

function splitContractId(contractId: string): { address: string; name: string } {
    const parts = contractId.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(`Invalid contract id: ${contractId}`);
    }
    return { address: parts[0], name: parts[1] };
}

export function GovernanceOpsPanel({
    contracts,
    operations,
    onRefresh,
}: GovernanceOpsPanelProps) {
    const { userAddress, isConnected, connect } = useWallet();
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successTx, setSuccessTx] = useState<string | null>(null);

    const [timelockDelay, setTimelockDelay] = useState('144');
    const [executorDelay, setExecutorDelay] = useState('10');
    const [globalPaused, setGlobalPaused] = useState(false);

    const [queueProposalId, setQueueProposalId] = useState('');
    const [queueProposalContract, setQueueProposalContract] = useState('');
    const [queueReadyAt, setQueueReadyAt] = useState('');

    const [executeProposalId, setExecuteProposalId] = useState('');
    const [executeProposalContract, setExecuteProposalContract] = useState('');
    const [executeSender, setExecuteSender] = useState('');

    const [guardrailMaxBps, setGuardrailMaxBps] = useState('2000');
    const [guardrailBlocks, setGuardrailBlocks] = useState('144');
    const [guardrailPeriodLimit, setGuardrailPeriodLimit] = useState('2000000000');

    const effectiveSender = useMemo(() => executeSender.trim() || userAddress || '', [executeSender, userAddress]);

    useEffect(() => {
        if (!operations) return;
        setTimelockDelay(operations.timelock.minDelayBlocks);
        setExecutorDelay(operations.executor.minDelayBlocks);
        setGlobalPaused(operations.emergency.globalPaused);
        setGuardrailMaxBps(operations.guardrails.maxSpendBps);
        setGuardrailBlocks(operations.guardrails.blocksPerPeriod);
        setGuardrailPeriodLimit(operations.guardrails.periodLimit);
    }, [operations]);

    const ensureWallet = async (): Promise<string> => {
        let senderAddress = userAddress;
        if (!senderAddress || !isConnected) {
            senderAddress = await connect();
        }
        if (!senderAddress) {
            throw new Error('Wallet connected, but no STX address was returned.');
        }
        return senderAddress;
    };

    const runAction = async (key: string, fn: () => Promise<{ txid?: string }>) => {
        setLoadingAction(key);
        setError(null);
        setSuccessTx(null);
        try {
            const result = await fn();
            setSuccessTx(result.txid ?? 'submitted');
            onRefresh();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoadingAction(null);
        }
    };

    if (!contracts) {
        return (
            <section className="section ops-section">
                <h2>Governance Ops</h2>
                <div className="card ops-panel">
                    <p className="ops-muted">DAO contracts are still loading.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="section ops-section">
            <h2>Governance Ops</h2>
            <p className="section-subtitle">Operational controls for execution, timelocks, emergency pause, and treasury guardrails.</p>
            <div className="card ops-panel">
                <div className="ops-grid">
                    <div className="ops-card">
                        <h3>Live Status</h3>
                        <ul className="ops-list">
                            <li>Timelock Delay: <strong>{operations?.timelock.minDelayBlocks ?? 'N/A'} blocks</strong></li>
                            <li>Executor Delay: <strong>{operations?.executor.minDelayBlocks ?? 'N/A'} blocks</strong></li>
                            <li>Guardian: <code>{operations?.emergency.guardian ?? 'N/A'}</code></li>
                            <li>Global Paused: <strong>{operations?.emergency.globalPaused ? 'YES' : 'NO'}</strong></li>
                            <li>Guardrail Max Spend: <strong>{operations?.guardrails.maxSpendBps ?? 'N/A'} bps</strong></li>
                            <li>Period Spent: <strong>{operations?.guardrails.currentPeriodSpent ?? 'N/A'}</strong></li>
                        </ul>
                        <button className="btn btn-secondary" onClick={onRefresh} disabled={Boolean(loadingAction)}>
                            Refresh Status
                        </button>
                    </div>

                    <div className="ops-card">
                        <h3>Execution Queue</h3>
                        <div className="ops-form">
                            <input
                                className="input"
                                placeholder="Proposal ID"
                                value={queueProposalId}
                                onChange={(e) => setQueueProposalId(e.target.value)}
                            />
                            <input
                                className="input"
                                placeholder="Proposal Contract (ST...contract)"
                                value={queueProposalContract}
                                onChange={(e) => setQueueProposalContract(e.target.value)}
                            />
                            <input
                                className="input"
                                placeholder="Ready At Block"
                                value={queueReadyAt}
                                onChange={(e) => setQueueReadyAt(e.target.value)}
                            />
                            <button
                                className="btn btn-primary"
                                disabled={loadingAction === 'queue'}
                                onClick={() =>
                                    runAction('queue', async () => {
                                        const sender = await ensureWallet();
                                        const { uintCV, contractPrincipalCV } = await import('@stacks/transactions');
                                        const parsed = splitContractId(queueProposalContract.trim());
                                        return callContract({
                                            address: sender,
                                            contract: contracts.proposalExecutor,
                                            functionName: 'queue-proposal',
                                            functionArgs: [
                                                uintCV(BigInt(queueProposalId.trim() || '0')),
                                                contractPrincipalCV(parsed.address, parsed.name),
                                                uintCV(BigInt(queueReadyAt.trim() || '0')),
                                            ],
                                        });
                                    })
                                }
                            >
                                Queue Proposal
                            </button>
                        </div>

                        <div className="ops-form">
                            <input
                                className="input"
                                placeholder="Proposal ID"
                                value={executeProposalId}
                                onChange={(e) => setExecuteProposalId(e.target.value)}
                            />
                            <input
                                className="input"
                                placeholder="Proposal Contract (ST...contract)"
                                value={executeProposalContract}
                                onChange={(e) => setExecuteProposalContract(e.target.value)}
                            />
                            <input
                                className="input"
                                placeholder="Execution Sender Principal"
                                value={executeSender}
                                onChange={(e) => setExecuteSender(e.target.value)}
                            />
                            <button
                                className="btn btn-secondary"
                                disabled={loadingAction === 'execute'}
                                onClick={() =>
                                    runAction('execute', async () => {
                                        const sender = await ensureWallet();
                                        const { uintCV, principalCV, contractPrincipalCV } = await import('@stacks/transactions');
                                        const parsed = splitContractId(executeProposalContract.trim());
                                        return callContract({
                                            address: sender,
                                            contract: contracts.proposalExecutor,
                                            functionName: 'execute-queued',
                                            functionArgs: [
                                                uintCV(BigInt(executeProposalId.trim() || '0')),
                                                contractPrincipalCV(parsed.address, parsed.name),
                                                principalCV(effectiveSender),
                                            ],
                                        });
                                    })
                                }
                            >
                                Execute Queued
                            </button>
                        </div>

                        <div className="ops-queued-list">
                            <h4>Queued Proposals</h4>
                            {(operations?.executor.queued ?? []).length === 0 ? (
                                <p className="ops-muted">No queued executions.</p>
                            ) : (
                                <ul>
                                    {(operations?.executor.queued ?? []).map((item) => (
                                        <li key={item.proposalId}>
                                            #{item.proposalId} ready@{item.readyAtBlock} executed={item.executed ? 'yes' : 'no'} canceled={item.canceled ? 'yes' : 'no'}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="ops-card">
                        <h3>Controls</h3>
                        <div className="ops-form ops-inline">
                            <input
                                className="input"
                                placeholder="Timelock Delay"
                                value={timelockDelay}
                                onChange={(e) => setTimelockDelay(e.target.value)}
                            />
                            <button
                                className="btn btn-secondary"
                                disabled={loadingAction === 'timelock'}
                                onClick={() =>
                                    runAction('timelock', async () => {
                                        const sender = await ensureWallet();
                                        const { uintCV } = await import('@stacks/transactions');
                                        return callContract({
                                            address: sender,
                                            contract: contracts.timelockController,
                                            functionName: 'set-min-delay',
                                            functionArgs: [uintCV(BigInt(timelockDelay.trim() || '0'))],
                                        });
                                    })
                                }
                            >
                                Set Timelock
                            </button>
                        </div>

                        <div className="ops-form ops-inline">
                            <input
                                className="input"
                                placeholder="Executor Delay"
                                value={executorDelay}
                                onChange={(e) => setExecutorDelay(e.target.value)}
                            />
                            <button
                                className="btn btn-secondary"
                                disabled={loadingAction === 'executor-delay'}
                                onClick={() =>
                                    runAction('executor-delay', async () => {
                                        const sender = await ensureWallet();
                                        const { uintCV } = await import('@stacks/transactions');
                                        return callContract({
                                            address: sender,
                                            contract: contracts.proposalExecutor,
                                            functionName: 'set-min-delay',
                                            functionArgs: [uintCV(BigInt(executorDelay.trim() || '0'))],
                                        });
                                    })
                                }
                            >
                                Set Executor Delay
                            </button>
                        </div>

                        <div className="ops-form ops-inline">
                            <label className="ops-checkbox">
                                <input
                                    type="checkbox"
                                    checked={globalPaused}
                                    onChange={(e) => setGlobalPaused(e.target.checked)}
                                />
                                Global Paused
                            </label>
                            <button
                                className="btn btn-error"
                                disabled={loadingAction === 'pause'}
                                onClick={() =>
                                    runAction('pause', async () => {
                                        const sender = await ensureWallet();
                                        const { boolCV } = await import('@stacks/transactions');
                                        return callContract({
                                            address: sender,
                                            contract: contracts.emergencyGuardian,
                                            functionName: 'set-global-paused',
                                            functionArgs: [boolCV(globalPaused)],
                                        });
                                    })
                                }
                            >
                                Apply Pause State
                            </button>
                        </div>

                        <div className="ops-form">
                            <h4>Treasury Guardrails</h4>
                            <input className="input" placeholder="Max Spend BPS" value={guardrailMaxBps} onChange={(e) => setGuardrailMaxBps(e.target.value)} />
                            <input className="input" placeholder="Blocks Per Period" value={guardrailBlocks} onChange={(e) => setGuardrailBlocks(e.target.value)} />
                            <input className="input" placeholder="Period Limit (uSTX)" value={guardrailPeriodLimit} onChange={(e) => setGuardrailPeriodLimit(e.target.value)} />
                            <button
                                className="btn btn-secondary"
                                disabled={loadingAction === 'guardrails'}
                                onClick={() =>
                                    runAction('guardrails', async () => {
                                        const sender = await ensureWallet();
                                        const { uintCV } = await import('@stacks/transactions');
                                        return callContract({
                                            address: sender,
                                            contract: contracts.treasuryGuardrails,
                                            functionName: 'set-policy',
                                            functionArgs: [
                                                uintCV(BigInt(guardrailMaxBps.trim() || '0')),
                                                uintCV(BigInt(guardrailBlocks.trim() || '0')),
                                                uintCV(BigInt(guardrailPeriodLimit.trim() || '0')),
                                            ],
                                        });
                                    })
                                }
                            >
                                Set Guardrails
                            </button>
                        </div>
                    </div>
                </div>

                {error ? <div className="ops-error">{error}</div> : null}
                {successTx ? <div className="ops-success">Submitted tx: <code>{successTx}</code></div> : null}
            </div>
        </section>
    );
}
