import { describe, expect, test } from '@jest/globals';

import { bindPropFn } from 'util/props';

describe('bindPropFn', () => {
    test('binds a function key to its object', () => {
        const props = {
            count: 0,
            inc(this: { count: number }) {
                this.count++;
            },
        };
        const inc = bindPropFn(props, 'inc', 'missing inc');
        inc();
        expect(props.count).toBe(1);
    });

    test('throws when key does not exist', () => {
        const props = {} as Record<string, unknown>;
        expect(() =>
            bindPropFn(props, 'missing' as unknown as never, 'missing'),
        ).toThrow('missing: Key missing does not exist on object');
    });

    test('throws when key is not a function', () => {
        const props = { count: 0 } as Record<string, unknown>;
        expect(() =>
            bindPropFn(props, 'count' as unknown as never, 'not fn'),
        ).toThrow('not fn: Key count is not a function');
    });
});
