/**
 * Anthropic Provider
 * Claude models (Claude 3 Opus, Sonnet, Haiku)
 */

import { BaseLLMProvider } from './base.js';
import type {
    LLMCompletionRequest,
    LLMCompletionResponse
} from '../types/llm.js';

export class AnthropicProvider extends BaseLLMProvider {
    name = 'anthropic' as const;
    private apiKey: string;

    constructor(apiKey: string, model: string = 'claude-3-sonnet-20240229') {
        super(model);
        this.apiKey = apiKey;
    }

    async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
        // Extract system message if present
        const systemMessage = request.messages.find(m => m.role === 'system');
        const otherMessages = request.messages.filter(m => m.role !== 'system');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: request.maxTokens ?? 2048,
                temperature: request.temperature ?? 0.7,
                system: systemMessage?.content,
                messages: otherMessages.map(m => ({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: m.content,
                })),
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic error: ${error}`);
        }

        const data = await response.json() as {
            content: [{ text: string }];
            model: string;
            usage: {
                input_tokens: number;
                output_tokens: number;
            };
        };

        return {
            content: data.content[0].text,
            model: data.model,
            usage: {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens,
            },
        };
    }

    async isAvailable(): Promise<boolean> {
        return !!this.apiKey;
    }
}
