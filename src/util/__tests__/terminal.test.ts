import { describe, expect, test } from '@jest/globals';

import { hasUnfinishedTimerBar, tokenize as tokenize } from 'util/terminal';

describe('splits commands list at semicolons', () => {
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

describe('match timer bar patterns', () => {
    test.each(['[-]', '[--]', '[-------------------]'])(
        'unstarted progress bar',
        (pattern) => {
            expect(hasUnfinishedTimerBar(pattern)).toBeTruthy();
        },
    );

    test.each(['[|-]', '[|-----]', '[|||---]', '[|||||-]'])(
        'in-progress bar',
        (pattern) => {
            expect(hasUnfinishedTimerBar(pattern)).toBeTruthy();
        },
    );

    test.each(['[|]', '[||||]', '[||||||||||||||||||]'])(
        'finished progress bar',
        (pattern) => {
            expect(hasUnfinishedTimerBar(pattern)).toBeTruthy();
        },
    );

    test.each([
        '[]',
        '[abc]',
        '[123]',
        '[-|]',
        '[--||]',
        '[-----|]',
        '[-|||||]',
    ])("doesn't match other similar patterns", (pattern) => {
        expect(hasUnfinishedTimerBar(pattern)).toBeFalsy();
    });
});
