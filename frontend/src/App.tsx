import { useState, useEffect } from 'react';
import './App.css';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { ProposalCard } from './components/ProposalCard';
import { AIChat } from './components/AIChat';
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
        daoAddress={DAO_ADDRESS}
        network={health?.stacks.network || 'testnet'}
        llmProvider={health?.llm.provider}
        llmAvailable={health?.llm.available}
      />

      <main className="main container">
        <section className="section">
          <h2>Dashboard</h2>
          <StatsCards
            treasuryBalance={125000}
            proposalCount={3}
            memberCount={156}
            healthScore={85}
          />
        </section>

        <div className="dashboard-grid">
          <section className="section proposals-section">
            <h2>Active Proposals</h2>
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
