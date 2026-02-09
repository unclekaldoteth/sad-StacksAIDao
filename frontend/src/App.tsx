import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { ProposalCard } from './components/ProposalCard';
import { AIChat } from './components/AIChat';
import { AIAgentCards } from './components/AIAgentCards';
import { AlertsPanel } from './components/AlertsPanel';
import { TreasuryPanel } from './components/TreasuryPanel';
import { CreateProposalModal } from './components/CreateProposalModal';
import { api } from './api/client';
import type {
  DaoAlertsResponse,
  DaoConfig,
  DaoOverview,
  DaoProposal,
  DaoTreasuryResponse,
  DaoVotingPower,
  HealthStatus,
  TreasuryInsight,
} from './api/client';
import { useWallet } from './contexts/useWallet';
import { formatMicroStx, shortPrincipal } from './utils/stx';

function App() {
  const { userAddress } = useWallet();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [daoConfig, setDaoConfig] = useState<DaoConfig | null>(null);
  const [overview, setOverview] = useState<DaoOverview | null>(null);
  const [proposals, setProposals] = useState<DaoProposal[]>([]);
  const [treasury, setTreasury] = useState<DaoTreasuryResponse | null>(null);
  const [treasuryInsight, setTreasuryInsight] = useState<TreasuryInsight | null>(null);
  const [votingPower, setVotingPower] = useState<DaoVotingPower | null>(null);
  const [alerts, setAlerts] = useState<DaoAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateProposal, setShowCreateProposal] = useState(false);

  useEffect(() => {
    Promise.all([
      api.health(),
      api.daoConfig(),
      api.daoOverview(),
      api.daoProposals(50),
      api.daoTreasury(10),
      api.daoAlerts(10, 10).catch(() => null),
    ])
      .then(([healthRes, configRes, overviewRes, proposalsRes, treasuryRes, alertsRes]) => {
        setHealth(healthRes);
        setDaoConfig(configRes);
        setOverview(overviewRes);
        setProposals(proposalsRes.proposals);
        setTreasury(treasuryRes);
        setAlerts(alertsRes);

        // Optional: ask the AI for treasury recommendations based on live on-chain data.
        // This is intentionally "best effort" and should not block the dashboard.
        const daoAddress = configRes.contracts.core;
        const recentTransactions = treasuryRes.recentSpends.slice(0, 10).map((s) => ({
          amount: Number(s.amount) / 1_000_000,
          recipient: s.recipient,
          timestamp: Number(s.spentAtBlock),
        }));
        void api
          .analyzeTreasury(daoAddress, {
            balance: Number(treasuryRes.stats.stxBalance) / 1_000_000,
            recentTransactions,
          })
          .then(setTreasuryInsight)
          .catch(() => setTreasuryInsight(null));
      })
      .catch((err) => {
        console.error(err);
        setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const refreshProposals = () => {
    void api
      .daoProposals(50)
      .then((res) => setProposals(res.proposals))
      .catch(console.error);
  };

  useEffect(() => {
    if (!userAddress) return;
    void api
      .daoVotingPower(userAddress)
      .then(setVotingPower)
      .catch(() => setVotingPower(null));
  }, [userAddress]);

  const daoTitle = useMemo(() => {
    const name = overview?.dao.name?.trim();
    return name && name.length > 0 ? name : 'Stacks AI DAO';
  }, [overview?.dao.name]);

  const daoAddress = daoConfig?.contracts.core ?? '';

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Connecting to AI Agent...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="loading-screen">
        <p>Failed to load dashboard:</p>
        <code style={{ maxWidth: 720, whiteSpace: 'pre-wrap', textAlign: 'left' }}>{loadError}</code>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        daoName={daoTitle}
        network={daoConfig?.network || health?.stacks.network || 'testnet'}
        llmAvailable={health?.llm.available}
      />

      <main className="main container">
        {/* Dashboard Stats */}
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

        {/* AI Agent Layer - matches architecture diagram */}
        <section className="section">
          <h2>🤖 AI Agent Layer</h2>
          <p className="section-subtitle">
            Intelligent agents monitoring and assisting with DAO governance
          </p>
          <AIAgentCards />
          <AlertsPanel
            riskScore={alerts?.riskScore ?? 0}
            alerts={alerts?.alerts ?? []}
            generatedAt={alerts?.generatedAt}
          />
        </section>

        {/* Main content grid */}
        <div className="dashboard-grid three-column">
          {/* Proposals Section - connected to Proposal Analyzer & Vote Recommender */}
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
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  daoAddress={daoAddress}
                  contracts={daoConfig?.contracts ?? null}
                  onTransactionSuccess={refreshProposals}
                />
              ))}
              {proposals.length === 0 && (
                <div className="card" style={{ padding: '1.25rem' }}>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    No proposals found yet.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Treasury Section - connected to Treasury Advisor */}
          <section className="section treasury-section">
            <TreasuryPanel
              balanceMicroStx={treasury?.stats.stxBalance ?? '0'}
              totalReceivedMicroStx={treasury?.stats.totalReceived ?? '0'}
              totalSpentMicroStx={treasury?.stats.totalSpent ?? '0'}
              healthScore={treasuryInsight?.healthScore}
              recentSpends={treasury?.recentSpends ?? []}
              recommendations={treasuryInsight?.recommendations ?? []}
            />
          </section>

          {/* Chat Section - connected to Risk Scanner for queries */}
          <section className="section chat-section">
            <AIChat daoAddress={daoAddress} />
          </section>
        </div>
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
