import { describe, expect, it } from 'vitest';
import { extractJsonObject } from '../src/agents/dao-agent.js';

describe('extractJsonObject', () => {
    it('parses direct JSON objects', () => {
        const parsed = extractJsonObject('{"summary":"ok","riskLevel":"low"}');
        expect(parsed).toEqual({ summary: 'ok', riskLevel: 'low' });
    });

    it('parses fenced JSON', () => {
        const parsed = extractJsonObject('```json\n{"vote":"for","confidence":80}\n```');
        expect(parsed).toEqual({ vote: 'for', confidence: 80 });
    });

    it('parses JSON embedded in natural language text', () => {
        const parsed = extractJsonObject('Here is the result:\n{"healthScore":91}\nThanks!');
        expect(parsed).toEqual({ healthScore: 91 });
    });

    it('returns null for invalid payload', () => {
        const parsed = extractJsonObject('not-json-response');
        expect(parsed).toBeNull();
    });
});
