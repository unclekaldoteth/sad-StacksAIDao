/**
 * DAO AI Agent Backend
 * Main entry point
 */

import express from 'express';
import { config } from './config/index.js';
import { apiRouter } from './api/routes.js';
import { ProviderFactory } from './providers/index.js';

const app = express();

// Middleware
app.use(express.json());

// CORS for frontend
app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
    }
    next();
});

// Mount API routes
app.use('/api', apiRouter);

// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        name: 'DAO AI Agent',
        version: '1.0.0',
        endpoints: [
            'GET  /api/health',
            'GET  /api/provider',
            'GET  /api/dao/config',
            'GET  /api/dao/overview',
            'GET  /api/dao/proposals',
            'GET  /api/dao/treasury',
            'GET  /api/dao/voting-power?address=ST...',
            'POST /api/analyze-proposal',
            'POST /api/voting-recommendation',
            'POST /api/analyze-treasury',
            'POST /api/chat',
        ],
    });
});

// Start server
async function start() {
    // Check LLM availability
    const llmAvailable = await ProviderFactory.checkAvailability();

    console.log('🤖 DAO AI Agent Starting...');
    console.log(`   Provider: ${config.llm.provider}`);
    console.log(`   LLM Available: ${llmAvailable ? '✅' : '❌'}`);
    console.log(`   Network: ${config.stacks.network}`);

    app.listen(config.port, () => {
        console.log(`\n🚀 Server running at http://localhost:${config.port}`);
    });
}

start().catch(console.error);
