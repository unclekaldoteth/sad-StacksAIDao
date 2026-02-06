/**
 * Ollama Provider
 * Local LLM via Ollama
 */

import { BaseLLMProvider } from './base.js';
import type {
    LLMCompletionRequest,
    LLMCompletionResponse,
    LLMStreamChunk
} from '../types/llm.js';

export class OllamaProvider extends BaseLLMProvider {
    name = 'ollama' as const;
    private baseUrl: string;

    constructor(baseUrl: string = 'http://localhost:11434', model: string = 'llama3.1') {
        super(model);
        this.baseUrl = baseUrl;
    }

    async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                messages: request.messages,
                stream: false,
                options: {
                    temperature: request.temperature ?? 0.7,
                    num_predict: request.maxTokens ?? 2048,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.statusText}`);
        }

        const data = await response.json() as {
            message: { content: string };
            model: string;
            prompt_eval_count?: number;
            eval_count?: number;
        };

        return {
            content: data.message.content,
            model: data.model,
            usage: {
                promptTokens: data.prompt_eval_count ?? 0,
                completionTokens: data.eval_count ?? 0,
                totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
            },
        };
    }

    async *stream(request: LLMCompletionRequest): AsyncGenerator<LLMStreamChunk> {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                messages: request.messages,
                stream: true,
                options: {
                    temperature: request.temperature ?? 0.7,
                    num_predict: request.maxTokens ?? 2048,
                },
            }),
        });

        if (!response.ok || !response.body) {
            throw new Error(`Ollama error: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const parseStreamLine = (line: string): LLMStreamChunk | null => {
            const trimmed = line.trim();
            if (!trimmed) {
                return null;
            }
            try {
                const data = JSON.parse(trimmed) as { message?: { content: string }; done: boolean };
                return {
                    content: data.message?.content ?? '',
                    done: data.done,
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
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return response.ok;
        } catch {
            return false;
        }
    }
}
