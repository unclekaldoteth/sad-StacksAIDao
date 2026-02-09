/**
 * API Routes
 * Express endpoints for the DAO AI Agent
 */

import { Router } from 'express';
import { DAOAgent } from '../agents/dao-agent.js';
import { computeDaoAlerts } from '../agents/risk-scanner.js';
import { getLLMProvider, ProviderFactory } from '../providers/index.js';
import { config } from '../config/index.js';
import {
    fetchDaoOverview,
    fetchDaoProposals,
    fetchDaoProposalById,
    fetchDaoTreasury,
    fetchVotingPower,
    getDaoConfig,
} from '../stacks/dao-state.js';
import { z } from 'zod';

const router = Router();

const analyzeProposalSchema = z.object({
    daoAddress: z.string().min(1),
    proposal: z.object({
        id: z.number().int().nonnegative(),
        title: z.string().min(1),
        description: z.string().min(1),
        proposer: z.string().min(1),
        amount: z.number().optional(),
    }),
});

const votingRecommendationSchema = z.object({
    daoAddress: z.string().min(1),
    proposal: z.object({
        id: z.number().int().nonnegative(),
        title: z.string().min(1),
        description: z.string().min(1),
        proposer: z.string().min(1).optional(),
        votesFor: z.number().nonnegative().optional(),
        votesAgainst: z.number().nonnegative().optional(),
    }),
    userPreferences: z.string().optional(),
});

const analyzeTreasurySchema = z.object({
    daoAddress: z.string().min(1),
    treasuryData: z.object({
        balance: z.number(),
        recentTransactions: z.array(z.object({
            amount: z.number(),
            recipient: z.string().min(1),
            timestamp: z.number(),
        })),
    }),
});

const chatSchema = z.object({
    daoAddress: z.string().min(1),
    message: z.string().min(1),
    context: z.object({
        daoAddress: z.string().min(1),
        userAddress: z.string().optional(),
        recentProposals: z.array(z.unknown()).optional(),
        treasuryBalance: z.number().optional(),
    }).optional(),
});

/**
 * Health check
 */
router.get('/health', async (_req, res) => {
    const llmAvailable = await ProviderFactory.checkAvailability();
    res.json({
        status: 'ok',
        llm: {
            provider: config.llm.provider,
            available: llmAvailable,
        },
        stacks: {
            network: config.stacks.network,
            deployer: config.stacks.daoDeployer,
        },
    });
});

/**
 * Get current LLM provider info
 */
router.get('/provider', async (_req, res) => {
    try {
        const provider = getLLMProvider();
        const available = await provider.isAvailable();
        res.json({
            name: provider.name,
            model: provider.getModel(),
            available,
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

/**
 * DAO Config (contracts + network)
 */
router.get('/dao/config', (_req, res) => {
    try {
        res.json(getDaoConfig());
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

/**
 * DAO Overview (DAO core + counts + treasury stats)
 */
router.get('/dao/overview', async (_req, res) => {
    try {
        const overview = await fetchDaoOverview();
        res.json(overview);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

/**
 * DAO Proposals (optionally limit to the last N)
 */
router.get('/dao/proposals', async (req, res) => {
    const querySchema = z.object({
        limit: z
            .string()
            .optional()
            .transform((v) => (v ? Number(v) : undefined))
            .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), {
                message: 'limit must be a positive number',
            }),
    });

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
        return;
    }

    try {
        const data = await fetchDaoProposals({ limit: parsed.data.limit });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

/**
 * DAO Treasury (stats + recent spends)
 */
router.get('/dao/treasury', async (req, res) => {
    const querySchema = z.object({
        recentSpendsLimit: z
            .string()
            .optional()
            .transform((v) => (v ? Number(v) : undefined))
            .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), {
                message: 'recentSpendsLimit must be a positive number',
            }),
    });

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
        return;
    }

    try {
        const data = await fetchDaoTreasury({ recentSpendsLimit: parsed.data.recentSpendsLimit });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

/**
 * DAO Alerts (risk scanner + heuristic alerts)
 */
router.get('/dao/alerts', async (req, res) => {
    const querySchema = z.object({
        proposalLimit: z
            .string()
            .optional()
            .transform((v) => (v ? Number(v) : undefined))
            .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), {
                message: 'proposalLimit must be a positive number',
            }),
        recentSpendsLimit: z
            .string()
            .optional()
            .transform((v) => (v ? Number(v) : undefined))
            .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), {
                message: 'recentSpendsLimit must be a positive number',
            }),
    });

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
        return;
    }

    const proposalLimit = parsed.data.proposalLimit ?? 10;
    const recentSpendsLimit = parsed.data.recentSpendsLimit ?? 10;

    try {
        const [overview, proposalsRes, treasury] = await Promise.all([
            fetchDaoOverview(),
            fetchDaoProposals({ limit: proposalLimit }),
            fetchDaoTreasury({ recentSpendsLimit }),
        ]);

        res.json(
            computeDaoAlerts({
                overview,
                proposals: proposalsRes.proposals,
                treasury,
            })
        );
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

/**
 * Voting power for an address (governance-token)
 */
router.get('/dao/voting-power', async (req, res) => {
    const querySchema = z.object({
        address: z.string().min(1),
    });

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
        return;
    }

    try {
        const data = await fetchVotingPower(parsed.data.address);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

/**
 * Analyze a proposal
 */
router.post('/analyze-proposal', async (req, res) => {
    try {
        const parsed = analyzeProposalSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: 'Invalid request body',
                details: parsed.error.flatten(),
            });
            return;
        }
        const { daoAddress, proposal } = parsed.data;
        const onChainProposal = await fetchDaoProposalById(BigInt(proposal.id));
        if (!onChainProposal) {
            res.status(404).json({ error: `Proposal ${proposal.id} not found on-chain` });
            return;
        }

        const agent = new DAOAgent(daoAddress);
        // Ignore client-provided proposal details: always analyze the chain as the source of truth.
        const analysis = await agent.analyzeProposal({
            id: proposal.id,
            title: onChainProposal.title,
            description: onChainProposal.description,
            proposer: onChainProposal.proposer,
            amount: proposal.amount,
        });
        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

/**
 * Get voting recommendation
 */
router.post('/voting-recommendation', async (req, res) => {
    try {
        const parsed = votingRecommendationSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: 'Invalid request body',
                details: parsed.error.flatten(),
            });
            return;
        }
        const { daoAddress, proposal, userPreferences } = parsed.data;
        const onChainProposal = await fetchDaoProposalById(BigInt(proposal.id));
        if (!onChainProposal) {
            res.status(404).json({ error: `Proposal ${proposal.id} not found on-chain` });
            return;
        }

        const agent = new DAOAgent(daoAddress);
        // Ignore client-provided proposal details: use the on-chain proposal and vote state.
        const recommendation = await agent.getVotingRecommendation(
            {
                id: proposal.id,
                title: onChainProposal.title,
                description: onChainProposal.description,
                proposer: onChainProposal.proposer,
                votesFor: onChainProposal.votes.for,
                votesAgainst: onChainProposal.votes.against,
            },
            userPreferences
        );
        res.json(recommendation);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

/**
 * Analyze treasury
 */
router.post('/analyze-treasury', async (req, res) => {
    try {
        const parsed = analyzeTreasurySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: 'Invalid request body',
                details: parsed.error.flatten(),
            });
            return;
        }
        const { daoAddress, treasuryData } = parsed.data;
        let chainTreasury: Awaited<ReturnType<typeof fetchDaoTreasury>> | null = null;
        try {
            chainTreasury = await fetchDaoTreasury({ recentSpendsLimit: 10 });
        } catch {
            chainTreasury = null;
        }

        const sourceTreasury = chainTreasury
            ? {
                balance: Number(chainTreasury.stats.stxBalance) / 1_000_000,
                recentTransactions: chainTreasury.recentSpends.slice(0, 10).map((s) => ({
                    amount: Number(s.amount) / 1_000_000,
                    recipient: s.recipient,
                    timestamp: Number(s.spentAtBlock),
                })),
            }
            : treasuryData;

        const agent = new DAOAgent(daoAddress);
        const insights = await agent.analyzeTreasury(sourceTreasury);
        res.json(insights);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

/**
 * Chat with the agent
 */
router.post('/chat', async (req, res) => {
    try {
        const parsed = chatSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: 'Invalid request body',
                details: parsed.error.flatten(),
            });
            return;
        }
        const { daoAddress, message, context } = parsed.data;
        const agent = new DAOAgent(daoAddress);
        // Always enrich chat with live on-chain context (best-effort).
        let enrichedContext = context;
        try {
            const [overview, proposalsRes] = await Promise.all([
                fetchDaoOverview(),
                fetchDaoProposals({ limit: 5 }),
            ]);
            enrichedContext = {
                daoAddress,
                userAddress: context?.userAddress,
                recentProposals: proposalsRes.proposals.map((p) => ({
                    id: p.id,
                    title: p.title,
                    status: p.status,
                })),
                treasuryBalance: Number(overview.treasury.stxBalance) / 1_000_000,
            };
        } catch {
            // Ignore enrichment failures; the agent can still answer general questions.
            enrichedContext = context;
        }

        const response = await agent.chat(message, enrichedContext);
        res.json({ response });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

export { router as apiRouter };
