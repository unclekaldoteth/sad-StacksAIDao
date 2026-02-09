/**
 * Application Configuration
 * Loads from environment variables
 */

import { config as loadEnv } from 'dotenv';
import type { LLMProviderType } from '../types/llm.js';

// Load .env file
loadEnv();

export const config = {
    // Server
    port: parseInt(process.env.PORT ?? '3001', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',

    // LLM Configuration
    llm: {
        provider: (process.env.LLM_PROVIDER ?? 'ollama') as LLMProviderType,

        ollama: {
            baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
            model: process.env.OLLAMA_MODEL ?? 'llama3.1',
        },

        openai: {
            apiKey: process.env.OPENAI_API_KEY ?? '',
            model: process.env.OPENAI_MODEL ?? 'gpt-4-turbo-preview',
        },

        anthropic: {
            apiKey: process.env.ANTHROPIC_API_KEY ?? '',
            model: process.env.ANTHROPIC_MODEL ?? 'claude-3-sonnet-20240229',
        },

        together: {
            apiKey: process.env.TOGETHER_API_KEY ?? '',
            model: process.env.TOGETHER_MODEL ?? 'meta-llama/Llama-3-70b-chat-hf',
        },

        groq: {
            apiKey: process.env.GROQ_API_KEY ?? '',
            model: process.env.GROQ_MODEL ?? 'llama3-70b-8192',
        },

        gemini: {
            apiKey: process.env.GEMINI_API_KEY ?? '',
            model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
        },
    },

    // Stacks Configuration
    stacks: {
        network: process.env.STACKS_NETWORK ?? 'testnet',
        apiUrl: process.env.STACKS_API_URL ?? 'https://api.testnet.hiro.so',
        daoDeployer: process.env.DAO_DEPLOYER_ADDRESS ?? '',
    },
};
