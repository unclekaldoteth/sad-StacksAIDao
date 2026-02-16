/**
 * Application Configuration
 * Loads from environment variables
 */

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import type { LLMProviderType } from '../types/llm.js';

// Load .env file
loadEnv();

const providerSchema = z.enum(['ollama', 'openai', 'anthropic', 'together', 'groq', 'gemini']);
const networkSchema = z.enum(['mainnet', 'testnet']);
const nodeEnvSchema = z.enum(['development', 'test', 'production']);

const envSchema = z.object({
    PORT: z.coerce.number().int().positive().default(3001),
    NODE_ENV: nodeEnvSchema.default('development'),

    LLM_PROVIDER: providerSchema.default('ollama'),

    OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
    OLLAMA_MODEL: z.string().trim().min(1).default('llama3.1'),

    OPENAI_API_KEY: z.string().default(''),
    OPENAI_MODEL: z.string().trim().min(1).default('gpt-4-turbo-preview'),

    ANTHROPIC_API_KEY: z.string().default(''),
    ANTHROPIC_MODEL: z.string().trim().min(1).default('claude-3-sonnet-20240229'),

    TOGETHER_API_KEY: z.string().default(''),
    TOGETHER_MODEL: z.string().trim().min(1).default('meta-llama/Llama-3-70b-chat-hf'),

    GROQ_API_KEY: z.string().default(''),
    GROQ_MODEL: z.string().trim().min(1).default('llama-3.3-70b-versatile'),

    GEMINI_API_KEY: z.string().default(''),
    GEMINI_MODEL: z.string().trim().min(1).default('gemini-2.0-flash'),

    STACKS_NETWORK: networkSchema.default('testnet'),
    STACKS_API_URL: z.string().url().default('https://api.testnet.hiro.so'),
    DAO_DEPLOYER_ADDRESS: z.string().default(''),
    DAO_FACTORY_CONTRACT_ID: z.string().default(''),
    DAO_DEFAULT_ID: z.string().default(''),
});

type RawEnv = z.infer<typeof envSchema>;

function nonEmpty(value: string): boolean {
    return value.trim().length > 0;
}

function validateEnv(rawEnv: RawEnv): RawEnv {
    const env: RawEnv = {
        ...rawEnv,
        OPENAI_API_KEY: rawEnv.OPENAI_API_KEY.trim(),
        ANTHROPIC_API_KEY: rawEnv.ANTHROPIC_API_KEY.trim(),
        TOGETHER_API_KEY: rawEnv.TOGETHER_API_KEY.trim(),
        GROQ_API_KEY: rawEnv.GROQ_API_KEY.trim(),
        GEMINI_API_KEY: rawEnv.GEMINI_API_KEY.trim(),
        DAO_DEPLOYER_ADDRESS: rawEnv.DAO_DEPLOYER_ADDRESS.trim(),
        DAO_FACTORY_CONTRACT_ID: rawEnv.DAO_FACTORY_CONTRACT_ID.trim(),
        DAO_DEFAULT_ID: rawEnv.DAO_DEFAULT_ID.trim(),
    };

    const errors: string[] = [];

    if (env.LLM_PROVIDER === 'openai' && !nonEmpty(env.OPENAI_API_KEY)) {
        errors.push('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
    }
    if (env.LLM_PROVIDER === 'anthropic' && !nonEmpty(env.ANTHROPIC_API_KEY)) {
        errors.push('ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic');
    }
    if (env.LLM_PROVIDER === 'together' && !nonEmpty(env.TOGETHER_API_KEY)) {
        errors.push('TOGETHER_API_KEY is required when LLM_PROVIDER=together');
    }
    if (env.LLM_PROVIDER === 'groq' && !nonEmpty(env.GROQ_API_KEY)) {
        errors.push('GROQ_API_KEY is required when LLM_PROVIDER=groq');
    }
    if (env.LLM_PROVIDER === 'gemini' && !nonEmpty(env.GEMINI_API_KEY)) {
        errors.push('GEMINI_API_KEY is required when LLM_PROVIDER=gemini');
    }

    if (!nonEmpty(env.DAO_DEPLOYER_ADDRESS) && !nonEmpty(env.DAO_FACTORY_CONTRACT_ID)) {
        errors.push('Set DAO_DEPLOYER_ADDRESS or DAO_FACTORY_CONTRACT_ID (at least one is required)');
    }

    if (nonEmpty(env.DAO_DEFAULT_ID) && !/^\d+$/.test(env.DAO_DEFAULT_ID)) {
        errors.push('DAO_DEFAULT_ID must be a positive integer string');
    }

    if (errors.length > 0) {
        throw new Error(`[config] Invalid environment configuration:\n- ${errors.join('\n- ')}`);
    }

    return env;
}

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const issues = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
        .join('\n- ');
    throw new Error(`[config] Failed to parse environment configuration:\n- ${issues}`);
}

const env = validateEnv(parsed.data);

export const config = {
    // Server
    port: env.PORT,
    nodeEnv: env.NODE_ENV,

    // LLM Configuration
    llm: {
        provider: env.LLM_PROVIDER as LLMProviderType,

        ollama: {
            baseUrl: env.OLLAMA_BASE_URL,
            model: env.OLLAMA_MODEL,
        },

        openai: {
            apiKey: env.OPENAI_API_KEY,
            model: env.OPENAI_MODEL,
        },

        anthropic: {
            apiKey: env.ANTHROPIC_API_KEY,
            model: env.ANTHROPIC_MODEL,
        },

        together: {
            apiKey: env.TOGETHER_API_KEY,
            model: env.TOGETHER_MODEL,
        },

        groq: {
            apiKey: env.GROQ_API_KEY,
            model: env.GROQ_MODEL,
        },

        gemini: {
            apiKey: env.GEMINI_API_KEY,
            model: env.GEMINI_MODEL,
        },
    },

    // Stacks Configuration
    stacks: {
        network: env.STACKS_NETWORK,
        apiUrl: env.STACKS_API_URL,
        daoDeployer: env.DAO_DEPLOYER_ADDRESS,
    },
};
