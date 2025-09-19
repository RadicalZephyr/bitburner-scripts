import type { NS } from '@ns';

import {
    createScriptResolver,
    type ResolveErr,
    type ResolveResult,
} from 'services/terminal/resolver';
import { tokenize } from 'services/terminal/tokenizer';
import {
    directoryExists,
    listImmediateChildren,
    normalizePath,
    splitDirBase,
} from 'services/terminal/vfs';
import { computePathMatches } from 'services/terminal/completion';

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
        expect(resolve('/', 'foo')).toEqual({
            ok: true,
            absPath: '/foo.js',
            script: 'foo.js',
        });
    });

    it('uses provided extension unchanged', () => {
        const ns = mockNs(new Set(['bar.ts']));
        const resolve = createScriptResolver(ns as NS);
        expect(resolve('/', 'bar.ts')).toEqual({
            ok: true,
            absPath: '/bar.ts',
            script: 'bar.ts',
        });
    });

    it('handles aliases', () => {
        const ns = mockNs(new Set(['baz.js']));
        const resolve = createScriptResolver(ns as NS, {
            aliases: { b: 'baz' },
        });
        expect(resolve('/', 'b')).toEqual({
            ok: true,
            absPath: '/baz.js',
            script: 'baz.js',
        });
    });

    it('returns friendly errors', () => {
        const ns = mockNs(new Set());
        const resolve = createScriptResolver(ns as NS);
        const result = resolve('/', 'missing');
        expectResolveErr(result);
        expect(result.message).toContain('missing.js');
    });
});

describe('normalizePath', () => {
    it('normalizes complex paths', () => {
        expect(normalizePath('/a//b/./c/..', '/')).toBe('/a/b');
    });

    it('clamps to root on parent traversal', () => {
        expect(normalizePath('../../x', '/')).toBe('/x');
    });

    it('resolves relative segments', () => {
        expect(normalizePath('scripts/util', '/home')).toBe(
            '/home/scripts/util',
        );
    });
});

describe('splitDirBase', () => {
    it('handles root path', () => {
        expect(splitDirBase('/')).toEqual({ dir: '/', base: '' });
    });

    it('splits directory and base', () => {
        expect(splitDirBase('/scripts/hack.js')).toEqual({
            dir: '/scripts',
            base: 'hack.js',
        });
    });
});

describe('virtual directory helpers', () => {
    const files = ['/foo.txt', '/scripts/hack.js', '/scripts/utils/helper.ts'];

    it('detects directory existence', () => {
        expect(directoryExists(files, '/scripts')).toBe(true);
        expect(directoryExists(files, '/missing')).toBe(false);
    });

    it('lists immediate children', () => {
        const result = listImmediateChildren(files, '/scripts');
        expect(result.exists).toBe(true);
        expect(result.entries.map((entry) => entry.name)).toEqual([
            'utils/',
            'hack.js',
        ]);
    });
});

describe('computePathMatches', () => {
    const files = [
        '/scripts/hack.js',
        '/scripts/utils/helper.ts',
        '/scripts/utils/extra/deep.js',
    ];

    it('enumerates children inside a completed directory', () => {
        const result = computePathMatches('scripts/', '/', files);
        expect(result).toEqual({
            prefix: 'scripts/',
            base: '',
            matches: [
                { name: 'utils/', absolutePath: '/scripts/utils', kind: 'dir' },
                {
                    name: 'hack.js',
                    absolutePath: '/scripts/hack.js',
                    kind: 'file',
                },
            ],
        });
    });

    it('filters matches relative to nested directories', () => {
        const result = computePathMatches('scripts/utils/h', '/', files);
        expect(result.prefix).toBe('scripts/utils/');
        expect(result.base).toBe('h');
        expect(result.matches.map((entry) => entry.name)).toEqual([
            'helper.ts',
        ]);
    });
});

function expectResolveErr(result: ResolveResult): asserts result is ResolveErr {
    if (result.ok) {
        throw new Error('expected resolve to fail');
    }
}
