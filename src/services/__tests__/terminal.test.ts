import type { NS } from '@ns';

import {
    createScriptResolver,
    type ResolveErr,
    type ResolveResult,
} from 'services/terminal/resolver';
import { tokenize } from 'services/terminal/tokenizer';

describe('tokenize', () => {
    it('splits on spaces', () => {
        const result = tokenize('a b');
        expect(result).toEqual({ ok: true, tokens: ['a', 'b'] });
    });

    it('honors double quotes', () => {
        const result = tokenize('"a b" c');
        expect(result).toEqual({ ok: true, tokens: ['a b', 'c'] });
    });

    it('honors single quotes', () => {
        const result = tokenize("'a b' c");
        expect(result).toEqual({ ok: true, tokens: ['a b', 'c'] });
    });

    it('respects escape sequences', () => {
        const result = tokenize('arg\\ with\\ space');
        expect(result).toEqual({ ok: true, tokens: ['arg with space'] });
    });

    it('keeps empty quoted tokens', () => {
        const result = tokenize('""');
        expect(result).toEqual({ ok: true, tokens: [''] });
    });

    it('detects unterminated quotes', () => {
        const result = tokenize('"unterminated');
        expect(result).toEqual({
            ok: false,
            message: 'unterminated double quote',
            index: 0,
        });
    });
});

describe('createScriptResolver', () => {
    function mockNs(files: Set<string>): Pick<NS, 'fileExists'> {
        return {
            fileExists: (name: string, host?: string) =>
                host === 'home' && files.has(name),
        } as Pick<NS, 'fileExists'>;
    }

    it('prefers js extension when missing', () => {
        const ns = mockNs(new Set(['foo.js']));
        const resolve = createScriptResolver(ns as NS);
        expect(resolve('foo')).toEqual({ ok: true, script: 'foo.js' });
    });

    it('uses provided extension unchanged', () => {
        const ns = mockNs(new Set(['bar.ts']));
        const resolve = createScriptResolver(ns as NS);
        expect(resolve('bar.ts')).toEqual({ ok: true, script: 'bar.ts' });
    });

    it('handles aliases', () => {
        const ns = mockNs(new Set(['baz.js']));
        const resolve = createScriptResolver(ns as NS, {
            aliases: { b: 'baz' },
        });
        expect(resolve('b')).toEqual({ ok: true, script: 'baz.js' });
    });

    it('returns friendly errors', () => {
        const ns = mockNs(new Set());
        const resolve = createScriptResolver(ns as NS);
        const result = resolve('missing');
        expectResolveErr(result);
        expect(result.message).toContain('missing.js');
    });
});

function expectResolveErr(result: ResolveResult): asserts result is ResolveErr {
    if (result.ok) {
        throw new Error('expected resolve to fail');
    }
}
