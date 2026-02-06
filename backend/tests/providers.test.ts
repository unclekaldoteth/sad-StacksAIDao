import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../src/providers/openai.js';
import { OllamaProvider } from '../src/providers/ollama.js';
import { AnthropicProvider } from '../src/providers/anthropic.js';

function createTextStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        },
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('OpenAIProvider', () => {
    it('keeps provider identity for OpenAI-compatible backends', () => {
        const together = new OpenAIProvider('test-key', 'test-model', 'https://api.together.xyz/v1', 'together');
        const groq = new OpenAIProvider('test-key', 'test-model', 'https://api.groq.com/openai/v1', 'groq');

        expect(together.name).toBe('together');
        expect(groq.name).toBe('groq');
    });

    it('streams correctly when chunks split SSE lines', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            statusText: 'OK',
            body: createTextStream([
                'data: {"choices":[{"delta":{"content":"Hel',
                'lo"}}]}\n',
                'data: {"choices":[{"delta":{"content":" world"}}]}\n',
                'data: [DONE]\n',
            ]),
        } as unknown as Response);
        vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

        const provider = new OpenAIProvider('test-key', 'test-model');
        const seenChunks: string[] = [];
        let sawDone = false;

        for await (const chunk of provider.stream!({
            messages: [{ role: 'user', content: 'Hello?' }],
        })) {
            seenChunks.push(chunk.content);
            if (chunk.done) {
                sawDone = true;
            }
        }

        expect(seenChunks.join('')).toBe('Hello world');
        expect(sawDone).toBe(true);
    });
});

describe('OllamaProvider', () => {
    it('streams correctly when chunks split JSON lines', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            statusText: 'OK',
            body: createTextStream([
                '{"message":{"content":"Hel"},"done":false}\n{"message":{"content":"lo"},"done"',
                ':false}\n{"done":true}\n',
            ]),
        } as unknown as Response);
        vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

        const provider = new OllamaProvider('http://localhost:11434', 'llama3.1');
        const seenChunks: string[] = [];
        let sawDone = false;

        for await (const chunk of provider.stream!({
            messages: [{ role: 'user', content: 'Hello?' }],
        })) {
            seenChunks.push(chunk.content);
            if (chunk.done) {
                sawDone = true;
            }
        }

        expect(seenChunks.join('')).toBe('Hello');
        expect(sawDone).toBe(true);
    });
});

describe('AnthropicProvider', () => {
    it('passes request temperature to Anthropic API', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                content: [{ text: 'ok' }],
                model: 'claude-test',
                usage: {
                    input_tokens: 1,
                    output_tokens: 1,
                },
            }),
        } as unknown as Response);
        vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

        const provider = new AnthropicProvider('test-key', 'claude-test');
        await provider.complete({
            messages: [{ role: 'user', content: 'Hello?' }],
            temperature: 0.12,
        });

        const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect(requestInit).toBeDefined();
        const body = JSON.parse(String(requestInit.body));
        expect(body.temperature).toBe(0.12);
    });
});
