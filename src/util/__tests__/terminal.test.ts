import { describe, expect, test } from '@jest/globals';

import { splitAtTimedCommands, tokenize } from 'util/terminal';

describe('tokenize splits commands list at semicolons', () => {
    test('untimed commands are split', () => {
        expect(tokenize('connect foo ; home ; scp thing')).toStrictEqual([
            'connect foo',
            'home',
            'scp thing',
        ]);
    });

    test('commands containing arguments are not split', () => {
        expect(tokenize('connect foo')).toStrictEqual(['connect foo']);
        expect(tokenize('thing ; scp hack.txt ; foo')).toStrictEqual([
            'thing',
            'scp hack.txt',
            'foo',
        ]);
    });

    test.each(['analyze', 'backdoor', 'grow', 'hack', 'weaken'])(
        'single timed commands are not split',
        (timedFn) => {
            expect(tokenize(timedFn)).toStrictEqual([timedFn]);
            const upcaseTimedFn = timedFn.toLocaleUpperCase();
            expect(tokenize(upcaseTimedFn)).toStrictEqual([upcaseTimedFn]);
        },
    );

    test('timed commands are separated from untimed commands', () => {
        expect(tokenize('connect foo ; hack')).toStrictEqual([
            'connect foo',
            'hack',
        ]);
        expect(tokenize('grow ; home')).toStrictEqual(['grow', 'home']);
        expect(tokenize('connect foo; weaken ;home')).toStrictEqual([
            'connect foo',
            'weaken',
            'home',
        ]);
        expect(tokenize('connect foo ;analyze; home')).toStrictEqual([
            'connect foo',
            'analyze',
            'home',
        ]);
    });

    test('timed commands are recognized regardless of case', () => {
        expect(tokenize('connect foo ; HACK ; home')).toStrictEqual([
            'connect foo',
            'HACK',
            'home',
        ]);
    });
});

describe('splitAtTimedCommands', () => {
    test('untimed commands are not split', () => {
        expect(
            splitAtTimedCommands('connect foo ; home ; scp thing'),
        ).toStrictEqual(['connect foo ; home ; scp thing']);
    });

    test('commands containing arguments are not split', () => {
        expect(splitAtTimedCommands('connect foo')).toStrictEqual([
            'connect foo',
        ]);
        expect(
            splitAtTimedCommands('thing ; scp hack.txt ; foo'),
        ).toStrictEqual(['thing ; scp hack.txt ; foo']);
    });

    test.each(['analyze', 'backdoor', 'grow', 'hack', 'weaken'])(
        'single timed commands are not split',
        (timedFn) => {
            expect(splitAtTimedCommands(timedFn)).toStrictEqual([timedFn]);
            const upcaseTimedFn = timedFn.toLocaleUpperCase();
            expect(splitAtTimedCommands(upcaseTimedFn)).toStrictEqual([
                upcaseTimedFn,
            ]);
        },
    );

    test('timed commands are separated from untimed commands', () => {
        expect(splitAtTimedCommands('connect foo ; hack')).toStrictEqual([
            'connect foo',
            'hack',
        ]);
        expect(splitAtTimedCommands('grow ; home')).toStrictEqual([
            'grow',
            'home',
        ]);
        expect(splitAtTimedCommands('connect foo; weaken ;home')).toStrictEqual(
            ['connect foo', 'weaken', 'home'],
        );
        expect(
            splitAtTimedCommands('connect foo ;analyze; home'),
        ).toStrictEqual(['connect foo', 'analyze', 'home']);
    });

    test('timed commands are recognized regardless of case', () => {
        expect(splitAtTimedCommands('connect foo ; HACK ; home')).toStrictEqual(
            ['connect foo', 'HACK', 'home'],
        );
    });
});
