import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { ProposalCard } from './components/ProposalCard';
import { AIChat } from './components/AIChat';
import { AlertsPanel } from './components/AlertsPanel';
import { TreasuryPanel } from './components/TreasuryPanel';
import { CreateProposalModal } from './components/CreateProposalModal';
import { GovernanceOpsPanel } from './components/GovernanceOpsPanel';
import { api } from './api/client';
import type {
  DaoAlertsResponse,
  DaoConfig,
  DaoOperationsResponse,
  DaoOverview,
  DaoProposal,
  DaoRegistryResponse,
  DaoTreasuryResponse,
  DaoVotingPower,
  HealthStatus,
  TreasuryInsight,
} from './api/client';
import { useWallet } from './contexts/useWallet';
import { stacksNetworkName } from './contexts/stacks';
import { formatMicroStx, shortPrincipal } from './utils/stx';

function shortContractId(contractId: string): string {
  if (contractId.length <= 40) {
    return contractId;
  }
  return `${contractId.slice(0, 24)}...${contractId.slice(-12)}`;
}

function formatContractKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

type UserView = 'overview' | 'proposals' | 'treasury' | 'operations';

const USER_VIEWS: Array<{ id: UserView; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'proposals', label: 'Proposals' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'operations', label: 'Operations' },
];

function App() {
  const { userAddress } = useWallet();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [daoRegistry, setDaoRegistry] = useState<DaoRegistryResponse | null>(null);
  const [selectedDaoId, setSelectedDaoId] = useState<string | undefined>(undefined);
  const [daoConfig, setDaoConfig] = useState<DaoConfig | null>(null);
  const [overview, setOverview] = useState<DaoOverview | null>(null);
  const [proposals, setProposals] = useState<DaoProposal[]>([]);
  const [treasury, setTreasury] = useState<DaoTreasuryResponse | null>(null);
  const [treasuryInsight, setTreasuryInsight] = useState<TreasuryInsight | null>(null);
  const [votingPower, setVotingPower] = useState<DaoVotingPower | null>(null);
  const [alerts, setAlerts] = useState<DaoAlertsResponse | null>(null);
  const [operations, setOperations] = useState<DaoOperationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [showContractDebug, setShowContractDebug] = useState(false);
  const [showGovernanceOps, setShowGovernanceOps] = useState(false);
  const [activeView, setActiveView] = useState<UserView>('overview');
  const loadRequestIdRef = useRef(0);

  const loadDao = (daoId: string | undefined, opts?: { keepExisting?: boolean }) => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setLoadError(null);
    if (!opts?.keepExisting) {
      setDaoConfig(null);
      setOverview(null);
      setProposals([]);
      setTreasury(null);
      setTreasuryInsight(null);
      setVotingPower(null);
      setAlerts(null);
      setOperations(null);
    }

    return Promise.all([
      api.daoConfig(daoId),
      api.daoOverview(daoId),
      api.daoProposals(daoId, 50),
      api.daoTreasury(daoId, 10),
      api.daoAlerts(daoId, 10, 10).catch(() => null),
      api.daoOperations(daoId, 20).catch(() => null),
    ])
      .then(([configRes, overviewRes, proposalsRes, treasuryRes, alertsRes, operationsRes]) => {
        if (requestId !== loadRequestIdRef.current) return;

        setDaoConfig(configRes);
        setOverview(overviewRes);
        setProposals(proposalsRes.proposals);
        setTreasury(treasuryRes);
        setAlerts(alertsRes);
        setOperations(operationsRes);

        // Optional: ask the AI for treasury recommendations based on live on-chain data.
        // This is intentionally "best effort" and should not block the dashboard.
        const daoAddress = configRes.contracts.core;
        const recentTransactions = treasuryRes.recentSpends.slice(0, 10).map((s) => ({
          amount: Number(s.amount) / 1_000_000,
          recipient: s.recipient,
          timestamp: Number(s.spentAtBlock),
        }));

        void api
          .analyzeTreasury(
            daoAddress,
            {
              balance: Number(treasuryRes.stats.stxBalance) / 1_000_000,
              recentTransactions,
            },
            daoId
          )
          .then((insight) => {
            if (requestId !== loadRequestIdRef.current) return;
            setTreasuryInsight(insight);
          })
          .catch(() => {
            if (requestId !== loadRequestIdRef.current) return;
            setTreasuryInsight(null);
          });
      })
      .catch((err) => {
        if (requestId !== loadRequestIdRef.current) return;
        console.error(err);
        setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (requestId !== loadRequestIdRef.current) return;
        setLoading(false);
      });
  };

  const loadBootstrap = () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setLoadError(null);

    return Promise.all([api.health(), api.daos(50).catch(() => null)])
      .then(([healthRes, registryRes]) => {
        if (requestId !== loadRequestIdRef.current) return;
        setHealth(healthRes);
        setDaoRegistry(registryRes);

        const initialDaoId =
          registryRes?.defaultDaoId ??
          registryRes?.daos[registryRes.daos.length - 1]?.daoId;
        setSelectedDaoId(initialDaoId);

        return loadDao(initialDaoId, { keepExisting: true });
      })
      .catch((err) => {
        if (requestId !== loadRequestIdRef.current) return;
        console.error(err);
        setLoadError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  };

  useEffect(() => {
    const requestId = ++loadRequestIdRef.current;
    Promise.all([api.health(), api.daos(50).catch(() => null)])
      .then(([healthRes, registryRes]) => {
        if (requestId !== loadRequestIdRef.current) return;
        setHealth(healthRes);
        setDaoRegistry(registryRes);

        const initialDaoId =
          registryRes?.defaultDaoId ??
          registryRes?.daos[registryRes.daos.length - 1]?.daoId;
        setSelectedDaoId(initialDaoId);

        return loadDao(initialDaoId, { keepExisting: true });
      })
      .catch((err) => {
        if (requestId !== loadRequestIdRef.current) return;
        console.error(err);
        setLoadError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  const refreshProposals = () => {
    void api
      .daoProposals(selectedDaoId, 50)
      .then((res) => setProposals(res.proposals))
      .catch(console.error);
  };

  useEffect(() => {
    if (!userAddress) return;
    void api
      .daoVotingPower(selectedDaoId, userAddress)
      .then(setVotingPower)
      .catch(() => setVotingPower(null));
  }, [selectedDaoId, userAddress]);

  const daoTitle = useMemo(() => {
    const name = overview?.dao.name?.trim();
    return name && name.length > 0 ? name : 'Stacks AI DAO';
  }, [overview?.dao.name]);

  const contractSetLabel = useMemo(() => {
    const core = daoConfig?.contracts.core ?? '';
    if (!core) return undefined;
    if (core.endsWith('.dao-core-v2-c4') || core.endsWith('.dao-core-v2-c4-v4')) {
      return 'Contracts v2-c4';
    }
    if (core.endsWith('.dao-core-v2')) {
      return 'Contracts v2 (legacy)';
    }
    return 'Contracts custom';
  }, [daoConfig?.contracts.core]);

  const daoAddress = daoConfig?.contracts.core ?? '';
  const activeProposalCount = proposals.filter((proposal) => proposal.status === 'active').length;
  const criticalAlertCount = (alerts?.alerts ?? []).filter((alert) => alert.level === 'critical').length;
  const attentionItems: string[] = [];
  if (activeProposalCount > 0) {
    attentionItems.push(`${activeProposalCount} proposal${activeProposalCount === 1 ? '' : 's'} currently active for voting.`);
  }
  if (criticalAlertCount > 0) {
    attentionItems.push(`${criticalAlertCount} critical risk alert${criticalAlertCount === 1 ? '' : 's'} detected.`);
  }
  if ((alerts?.riskScore ?? 0) >= 70) {
    attentionItems.push(`Risk score is elevated at ${alerts?.riskScore ?? 0}/100.`);
  }
  if (typeof treasuryInsight?.healthScore === 'number' && treasuryInsight.healthScore <= 40) {
    attentionItems.push(`Treasury health score is low (${treasuryInsight.healthScore}/100).`);
  }
  const isInitialLoading = loading && !overview && proposals.length === 0 && !treasury && !daoConfig;

  const retryLoad = () => {
    if (!health && !daoRegistry) {
      void loadBootstrap();
      return;
    }
    void loadDao(selectedDaoId, { keepExisting: true });
  };

  if (isInitialLoading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Connecting to AI Agent...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        daoName={daoTitle}
        network={daoConfig?.network || health?.stacks.network || stacksNetworkName}
        contractSetLabel={contractSetLabel}
        llmAvailable={health?.llm.available}
        daoOptions={daoRegistry?.daos.map((d) => ({ id: d.daoId, name: d.name })) ?? []}
        selectedDaoId={selectedDaoId}
        onDaoChange={(nextDaoId) => {
          setSelectedDaoId(nextDaoId);
          void loadDao(nextDaoId, { keepExisting: true });
        }}
      />

      <main className="main container">
        <section className="section section-nav">
          <div className="view-tabs" role="tablist" aria-label="Main dashboard views">
            {USER_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={activeView === view.id}
                className={`view-tab-btn ${activeView === view.id ? 'active' : ''}`}
                onClick={() => setActiveView(view.id)}
              >
                {view.label}
              </button>
            ))}
          </div>
        </section>

        {loadError ? (
          <section className="section">
            <div className="card inline-error">
              <p>{loadError}</p>
              <button className="btn btn-secondary" onClick={retryLoad} disabled={loading}>
                {loading ? 'Retrying...' : 'Retry Load'}
              </button>
            </div>
          </section>
        ) : null}

        {activeView === 'overview' ? (
          <>
            <section className="section">
              <div className="card action-center">
                <div className="action-center-header">
                  <h2>Needs Attention</h2>
                  <span className={`badge ${attentionItems.length > 0 ? 'badge-warning' : 'badge-success'}`}>
                    {attentionItems.length > 0 ? `${attentionItems.length} Signals` : 'All Clear'}
                  </span>
                </div>
                {attentionItems.length > 0 ? (
                  <ul className="attention-list">
                    {attentionItems.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="attention-empty">No urgent governance or treasury issues detected right now.</p>
                )}
                {loading ? <p className="refresh-note">Refreshing live chain data...</p> : null}
                <div className="action-center-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (activeProposalCount > 0) {
                        setActiveView('proposals');
                        return;
                      }
                      setShowCreateProposal(true);
                    }}
                  >
                    {activeProposalCount > 0
                      ? `Vote on ${activeProposalCount} Active Proposal${activeProposalCount === 1 ? '' : 's'}`
                      : 'Create New Proposal'}
                  </button>
                  <button className="btn btn-secondary" onClick={retryLoad} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh Data'}
                  </button>
                </div>
              </div>
            </section>

            <section className="section">
              <h2>Dashboard</h2>
              <StatsCards
                treasuryBalanceStx={formatMicroStx(overview?.treasury.stxBalance ?? '0')}
                proposalCount={Number(overview?.counts.proposals ?? 0)}
                memberCount={Number(overview?.counts.members ?? 0)}
                healthScore={treasuryInsight?.healthScore}
                riskScore={alerts?.riskScore}
                alertCount={alerts?.alerts.length}
                userVotingPowerStx={
                  votingPower ? formatMicroStx(votingPower.votingPower) : null
                }
                userAddress={userAddress ? shortPrincipal(userAddress) : null}
              />
            </section>

            <div className="dashboard-grid">
              <section className="section">
                <AlertsPanel
                  riskScore={alerts?.riskScore ?? 0}
                  alerts={alerts?.alerts ?? []}
                  generatedAt={alerts?.generatedAt}
                />
              </section>
              <section className="section">
                <TreasuryPanel
                  balanceMicroStx={treasury?.stats.stxBalance ?? '0'}
                  totalReceivedMicroStx={treasury?.stats.totalReceived ?? '0'}
                  totalSpentMicroStx={treasury?.stats.totalSpent ?? '0'}
                  healthScore={treasuryInsight?.healthScore}
                  recentSpends={treasury?.recentSpends ?? []}
                  recommendations={treasuryInsight?.recommendations ?? []}
                />
              </section>
            </div>
          </>
        ) : null}

        {activeView === 'proposals' ? (
          <div className="dashboard-grid">
            <section className="section proposals-section">
              <div className="section-header">
                <h2>📜 Proposals</h2>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCreateProposal(true)}
                  disabled={!daoConfig}
                  title={!daoConfig ? 'Loading DAO config...' : 'Create a new on-chain proposal'}
                >
                  New Proposal
                </button>
              </div>
              <div className="proposals-list">
                {loading && proposals.length === 0 ? (
                  <div className="card section-loading">
                    <div className="loader"></div>
                    <p>Loading proposals...</p>
                    <button className="btn btn-secondary" onClick={retryLoad} disabled={loading}>
                      Retry
                    </button>
                  </div>
                ) : null}

                {proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    daoAddress={daoAddress}
                    contracts={daoConfig?.contracts ?? null}
                    onTransactionSuccess={refreshProposals}
                  />
                ))}

                {!loading && proposals.length === 0 ? (
                  <div className="card section-empty">
                    <p>No proposals found yet.</p>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="section chat-section">
              <AIChat daoAddress={daoAddress} />
            </section>
          </div>
        ) : null}

        {activeView === 'treasury' ? (
          <div className="dashboard-grid">
            <section className="section">
              <h2>🏦 Treasury</h2>
              {loading && !treasury ? (
                <div className="card section-loading">
                  <div className="loader"></div>
                  <p>Loading treasury state...</p>
                  <button className="btn btn-secondary" onClick={retryLoad} disabled={loading}>
                    Retry
                  </button>
                </div>
              ) : (
                <TreasuryPanel
                  balanceMicroStx={treasury?.stats.stxBalance ?? '0'}
                  totalReceivedMicroStx={treasury?.stats.totalReceived ?? '0'}
                  totalSpentMicroStx={treasury?.stats.totalSpent ?? '0'}
                  healthScore={treasuryInsight?.healthScore}
                  recentSpends={treasury?.recentSpends ?? []}
                  recommendations={treasuryInsight?.recommendations ?? []}
                />
              )}
              <AlertsPanel
                riskScore={alerts?.riskScore ?? 0}
                alerts={alerts?.alerts ?? []}
                generatedAt={alerts?.generatedAt}
              />
            </section>

            <section className="section chat-section">
              <AIChat daoAddress={daoAddress} />
            </section>
          </div>
        ) : null}

        {activeView === 'operations' ? (
          <section className="section section-advanced">
            <div className="section-header">
              <h2>Advanced Tools</h2>
              <span className="badge badge-warning">Operator Area</span>
            </div>

            <div className="card advanced-gate">
              <h3>Governance Operations</h3>
              <p>
                Queue executions, change delays, emergency pause, and treasury guardrails are hidden by
                default because they can change protocol behavior.
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => setShowGovernanceOps((v) => !v)}
              >
                {showGovernanceOps ? 'Hide Governance Ops' : 'Reveal Governance Ops'}
              </button>
            </div>

            {showGovernanceOps ? (
              <GovernanceOpsPanel
                contracts={daoConfig?.contracts ?? null}
                operations={operations}
                onRefresh={() => {
                  void loadDao(selectedDaoId, { keepExisting: true });
                }}
              />
            ) : null}

            {daoConfig ? (
              <div className="card contract-debug">
                <div className="contract-debug-header">
                  <h3>On-Chain Contract Set</h3>
                  <button
                    className="btn btn-secondary contract-debug-toggle"
                    onClick={() => setShowContractDebug((v) => !v)}
                  >
                    {showContractDebug ? 'Hide Contract IDs' : 'Show Contract IDs'}
                  </button>
                </div>
                <p className="contract-debug-copy">
                  Active contract IDs loaded from backend configuration for the selected DAO.
                </p>
                {showContractDebug ? (
                  <div className="contract-debug-grid">
                    {(Object.entries(daoConfig.contracts) as Array<[string, string]>).map(([name, contractId]) => (
                      <Fragment key={name}>
                        <span>{formatContractKey(name)}</span>
                        <code>{shortContractId(contractId)}</code>
                      </Fragment>
                    ))}
                  </div>
                ) : (
                  <p className="contract-debug-collapsed">
                    {(contractSetLabel ?? 'Contracts') + ` • ${Object.keys(daoConfig.contracts).length} loaded`}
                  </p>
                )}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="footer">
        <div className="container">
          <p>DAO Factory • Powered by AI • Built on Stacks</p>
        </div>
      </footer>

      <CreateProposalModal
        open={showCreateProposal}
        daoAddress={daoAddress}
        contracts={daoConfig?.contracts ?? null}
        onClose={() => setShowCreateProposal(false)}
        onCreated={() => {
          setShowCreateProposal(false);
          refreshProposals();
        }}
      />
    </div>
  );
}

export default App;
