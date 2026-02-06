/**
 * LLM Provider Types
 * Supports multiple LLM backends with a unified interface
 */

export type LLMProviderType = 'ollama' | 'openai' | 'anthropic' | 'together' | 'groq';

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMCompletionRequest {
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}

export interface LLMCompletionResponse {
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface LLMStreamChunk {
    content: string;
    done: boolean;
}

/**
 * LLM Provider Interface
 * All providers must implement this interface
 */
export interface LLMProvider {
    name: LLMProviderType;

    /**
     * Generate a completion from the LLM
     */
    complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;

    /**
     * Stream a completion from the LLM
     */
    stream?(request: LLMCompletionRequest): AsyncGenerator<LLMStreamChunk>;

    /**
     * Check if the provider is available/configured
     */
    isAvailable(): Promise<boolean>;

    /**
     * Get the current model name
     */
    getModel(): string;
}

/**
 * Provider Configuration
 */
export interface ProviderConfig {
    ollama?: {
        baseUrl: string;
        model: string;
    };
    openai?: {
        apiKey: string;
        model: string;
    };
    anthropic?: {
        apiKey: string;
        model: string;
    };
    together?: {
        apiKey: string;
        model: string;
    };
    groq?: {
        apiKey: string;
        model: string;
    };
}
