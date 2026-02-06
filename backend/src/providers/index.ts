/**
 * LLM Provider Factory
 * Creates the appropriate provider based on configuration
 */

import type { LLMProvider, LLMProviderType } from '../types/llm.js';
import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { config } from '../config/index.js';

export class ProviderFactory {
    private static instance: LLMProvider | null = null;

    /**
     * Get the configured LLM provider
     */
    static getProvider(): LLMProvider {
        if (this.instance) {
            return this.instance;
        }

        const providerType = config.llm.provider;

        switch (providerType) {
            case 'ollama':
                this.instance = new OllamaProvider(
                    config.llm.ollama.baseUrl,
                    config.llm.ollama.model
                );
                break;

            case 'openai':
                if (!config.llm.openai.apiKey) {
                    throw new Error('OpenAI API key not configured');
                }
                this.instance = new OpenAIProvider(
                    config.llm.openai.apiKey,
                    config.llm.openai.model
                );
                break;

            case 'anthropic':
                if (!config.llm.anthropic.apiKey) {
                    throw new Error('Anthropic API key not configured');
                }
                this.instance = new AnthropicProvider(
                    config.llm.anthropic.apiKey,
                    config.llm.anthropic.model
                );
                break;

            case 'together':
                // Together AI uses OpenAI-compatible API
                if (!config.llm.together.apiKey) {
                    throw new Error('Together AI API key not configured');
                }
                this.instance = new OpenAIProvider(
                    config.llm.together.apiKey,
                    config.llm.together.model,
                    'https://api.together.xyz/v1',
                    'together'
                );
                break;

            case 'groq':
                // Groq uses OpenAI-compatible API
                if (!config.llm.groq.apiKey) {
                    throw new Error('Groq API key not configured');
                }
                this.instance = new OpenAIProvider(
                    config.llm.groq.apiKey,
                    config.llm.groq.model,
                    'https://api.groq.com/openai/v1',
                    'groq'
                );
                break;

            default:
                throw new Error(`Unknown LLM provider: ${providerType}`);
        }

        return this.instance;
    }

    /**
     * Reset the provider instance (useful for testing or switching providers)
     */
    static reset(): void {
        this.instance = null;
    }

    /**
     * Check if the configured provider is available
     */
    static async checkAvailability(): Promise<boolean> {
        try {
            const provider = this.getProvider();
            return await provider.isAvailable();
        } catch {
            return false;
        }
    }
}

// Export convenience function
export function getLLMProvider(): LLMProvider {
    return ProviderFactory.getProvider();
}
