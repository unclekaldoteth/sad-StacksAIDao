/**
 * API Routes
 * Express endpoints for the DAO AI Agent
 */

import { Router } from 'express';
import { DAOAgent } from '../agents/dao-agent.js';
import { getLLMProvider, ProviderFactory } from '../providers/index.js';
import { config } from '../config/index.js';
import { z } from 'zod';

const router = Router();

const analyzeProposalSchema = z.object({
    daoAddress: z.string().min(1),
    proposal: z.object({
        id: z.number(),
        title: z.string().min(1),
        description: z.string().min(1),
        proposer: z.string().min(1),
        amount: z.number().optional(),
    }),
});

const votingRecommendationSchema = z.object({
    daoAddress: z.string().min(1),
    proposal: z.object({
        id: z.number(),
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
        const agent = new DAOAgent(daoAddress);
        const analysis = await agent.analyzeProposal(proposal);
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
        const agent = new DAOAgent(daoAddress);
        const recommendation = await agent.getVotingRecommendation(proposal, userPreferences);
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
        const agent = new DAOAgent(daoAddress);
        const insights = await agent.analyzeTreasury(treasuryData);
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
        const response = await agent.chat(message, context);
        res.json({ response });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

export { router as apiRouter };
