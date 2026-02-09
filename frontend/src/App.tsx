import { useState, useEffect } from 'react';
import './App.css';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { ProposalCard } from './components/ProposalCard';
import { AIChat } from './components/AIChat';
import { AIAgentCards } from './components/AIAgentCards';
import { TreasuryPanel } from './components/TreasuryPanel';
import { api } from './api/client';
import type { HealthStatus } from './api/client';

// Demo data
const DAO_ADDRESS = 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM';

const DEMO_PROPOSALS = [
  {
    id: 1,
    title: 'Fund Community Development Initiative',
    description: 'Allocate 5,000 STX for community outreach, developer workshops, and educational content creation.',
    proposer: 'ST1ABC...XYZ',
    status: 'active' as const,
    votesFor: 12500,
    votesAgainst: 3200,
  },
  {
    id: 2,
    title: 'Upgrade Governance Smart Contracts',
    description: 'Deploy v2 of governance contracts with improved voting mechanisms and delegation support.',
    proposer: 'ST2DEF...UVW',
    status: 'pending' as const,
    votesFor: 0,
    votesAgainst: 0,
  },
  {
    id: 3,
    title: 'Partnership with DeFi Protocol',
    description: 'Establish strategic partnership for liquidity provision and cross-protocol integrations.',
    proposer: 'ST3GHI...RST',
    status: 'passed' as const,
    votesFor: 45000,
    votesAgainst: 8000,
  },
];

const DEMO_TRANSACTIONS = [
  { amount: 10000, recipient: 'Developer Fund', type: 'outflow' as const, timestamp: '2h ago' },
  { amount: 50000, recipient: 'Token Sale', type: 'inflow' as const, timestamp: '1d ago' },
  { amount: 2500, recipient: 'Marketing Budget', type: 'outflow' as const, timestamp: '3d ago' },
];

const TREASURY_RECOMMENDATIONS = [
  'Consider diversifying treasury with stablecoins for reduced volatility',
  'Current burn rate suggests 18-month runway - healthy position',
  'Large pending proposal (#1) would reduce runway to 14 months',
];

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.health()
      .then(setHealth)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
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
        daoName="Stacks AI DAO"
        network={health?.stacks.network || 'testnet'}
        llmAvailable={health?.llm.available}
      />

      <main className="main container">
        {/* Dashboard Stats */}
        <section className="section">
          <h2>Dashboard</h2>
          <StatsCards
            treasuryBalance={125000}
            proposalCount={3}
            memberCount={156}
            healthScore={85}
          />
        </section>

        {/* AI Agent Layer - matches architecture diagram */}
        <section className="section">
          <h2>🤖 AI Agent Layer</h2>
          <p className="section-subtitle">
            Intelligent agents monitoring and assisting with DAO governance
          </p>
          <AIAgentCards />
        </section>

        {/* Main content grid */}
        <div className="dashboard-grid three-column">
          {/* Proposals Section - connected to Proposal Analyzer & Vote Recommender */}
          <section className="section proposals-section">
            <h2>📜 Proposals</h2>
            <div className="proposals-list">
              {DEMO_PROPOSALS.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  daoAddress={DAO_ADDRESS}
                />
              ))}
            </div>
          </section>

          {/* Treasury Section - connected to Treasury Advisor */}
          <section className="section treasury-section">
            <TreasuryPanel
              balance={125000}
              healthScore={85}
              recentTransactions={DEMO_TRANSACTIONS}
              recommendations={TREASURY_RECOMMENDATIONS}
            />
          </section>

          {/* Chat Section - connected to Risk Scanner for queries */}
          <section className="section chat-section">
            <AIChat daoAddress={DAO_ADDRESS} />
          </section>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>DAO Factory • Powered by AI • Built on Stacks</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
