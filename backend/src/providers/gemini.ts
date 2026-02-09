/**
 * Gemini Provider
 * Google Gemini API (gemini-1.5-flash, gemini-1.5-pro, etc.)
 */

import { BaseLLMProvider } from './base.js';
import type {
    LLMCompletionRequest,
    LLMCompletionResponse,
    LLMStreamChunk
} from '../types/llm.js';

export class GeminiProvider extends BaseLLMProvider {
    name = 'gemini' as const;
    private apiKey: string;
    private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta';

    constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
        super(model);
        this.apiKey = apiKey;
    }

    async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
        // Convert messages to Gemini format
        const contents = this.convertMessages(request.messages);

        const response = await fetch(
            `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: request.temperature ?? 0.7,
                        maxOutputTokens: request.maxTokens ?? 2048,
                    },
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini error: ${error}`);
        }

        const data = await response.json() as {
            candidates?: [{
                content?: {
                    parts?: [{ text?: string }];
                };
            }];
            usageMetadata?: {
                promptTokenCount?: number;
                candidatesTokenCount?: number;
                totalTokenCount?: number;
            };
        };

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
        const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

        return {
            content,
            model: this.model,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
            },
        };
    }

    async *stream(request: LLMCompletionRequest): AsyncGenerator<LLMStreamChunk> {
        const contents = this.convertMessages(request.messages);

        const response = await fetch(
            `${this.baseUrl}/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: request.temperature ?? 0.7,
                        maxOutputTokens: request.maxTokens ?? 2048,
                    },
                }),
            }
        );

        if (!response.ok || !response.body) {
            throw new Error(`Gemini error: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (!line.startsWith('data:')) continue;

                const data = line.slice(5).trim();
                if (!data) continue;

                try {
                    const parsed = JSON.parse(data) as {
                        candidates?: [{
                            content?: {
                                parts?: [{ text?: string }];
                            };
                        }];
                    };
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                    yield { content: text, done: false };
                } catch {
                    // Skip malformed JSON
                }
            }
        }

        yield { content: '', done: true };
    }

    async isAvailable(): Promise<boolean> {
        if (!this.apiKey) return false;

        try {
            const response = await fetch(
                `${this.baseUrl}/models/${this.model}?key=${this.apiKey}`
            );
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Convert OpenAI-style messages to Gemini format
     */
    private convertMessages(messages: LLMCompletionRequest['messages']): Array<{
        role: string;
        parts: [{ text: string }];
    }> {
        const contents: Array<{ role: string; parts: [{ text: string }] }> = [];
        let systemPrompt = '';

        for (const msg of messages) {
            if (msg.role === 'system') {
                // Gemini handles system prompts by prepending to first user message
                systemPrompt += msg.content + '\n\n';
            } else {
                const role = msg.role === 'user' ? 'user' : 'model';
                let text = msg.content;

                // Prepend system prompt to first user message
                if (role === 'user' && systemPrompt && contents.length === 0) {
                    text = systemPrompt + text;
                    systemPrompt = '';
                }

                contents.push({
                    role,
                    parts: [{ text }],
                });
            }
        }

        // If only system prompt exists, convert to user message
        if (contents.length === 0 && systemPrompt) {
            contents.push({
                role: 'user',
                parts: [{ text: systemPrompt.trim() }],
            });
        }

        return contents;
    }
}
