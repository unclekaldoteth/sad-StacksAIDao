/**
 * OpenAI Provider
 * Compatible with OpenAI API (GPT-4, GPT-3.5, etc.)
 */

import { BaseLLMProvider } from './base.js';
import type {
    LLMCompletionRequest,
    LLMCompletionResponse,
    LLMStreamChunk
} from '../types/llm.js';

type OpenAICompatibleProviderName = 'openai' | 'together' | 'groq';

export class OpenAIProvider extends BaseLLMProvider {
    name: OpenAICompatibleProviderName;
    private apiKey: string;
    private baseUrl: string;

    constructor(
        apiKey: string,
        model: string = 'gpt-4-turbo-preview',
        baseUrl: string = 'https://api.openai.com/v1',
        providerName: OpenAICompatibleProviderName = 'openai'
    ) {
        super(model);
        this.name = providerName;
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: request.messages,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens ?? 2048,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI error: ${error}`);
        }

        const data = await response.json() as {
            choices: [{ message: { content: string | null } }];
            model: string;
            usage?: {
                prompt_tokens: number;
                completion_tokens: number;
                total_tokens: number;
            };
        };

        const promptTokens = data.usage?.prompt_tokens ?? 0;
        const completionTokens = data.usage?.completion_tokens ?? 0;
        const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens);

        return {
            content: data.choices[0]?.message?.content ?? '',
            model: data.model,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens,
            },
        };
    }

    async *stream(request: LLMCompletionRequest): AsyncGenerator<LLMStreamChunk> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: request.messages,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens ?? 2048,
                stream: true,
            }),
        });

        if (!response.ok || !response.body) {
            throw new Error(`OpenAI error: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const parseStreamLine = (rawLine: string): LLMStreamChunk | null => {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) {
                return null;
            }

            const data = line.slice(5).trimStart();
            if (data === '[DONE]') {
                return { content: '', done: true };
            }

            try {
                const parsed = JSON.parse(data) as {
                    choices?: [{ delta?: { content?: string } }]
                };
                return {
                    content: parsed.choices?.[0]?.delta?.content ?? '',
                    done: false,
                };
            } catch {
                return null;
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                const parsedChunk = parseStreamLine(line);
                if (!parsedChunk) {
                    continue;
                }
                yield parsedChunk;
                if (parsedChunk.done) {
                    return;
                }
            }
        }

        buffer += decoder.decode();
        if (buffer.trim().length > 0) {
            const parsedChunk = parseStreamLine(buffer);
            if (parsedChunk) {
                yield parsedChunk;
            }
        }
    }

    async isAvailable(): Promise<boolean> {
        return !!this.apiKey;
    }
}
