/**
 * Base LLM Provider
 * Abstract class that all providers extend
 */

import type {
    LLMProvider,
    LLMProviderType,
    LLMCompletionRequest,
    LLMCompletionResponse,
    LLMStreamChunk
} from '../types/llm.js';

export abstract class BaseLLMProvider implements LLMProvider {
    abstract name: LLMProviderType;
    protected model: string;

    constructor(model: string) {
        this.model = model;
    }

    abstract complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;

    async *stream?(request: LLMCompletionRequest): AsyncGenerator<LLMStreamChunk> {
        // Default implementation: just yield the full completion
        const response = await this.complete(request);
        yield { content: response.content, done: true };
    }

    abstract isAvailable(): Promise<boolean>;

    getModel(): string {
        return this.model;
    }

    /**
     * Format messages for the specific provider
     */
    protected formatMessages(messages: LLMCompletionRequest['messages']): unknown {
        return messages;
    }
}
