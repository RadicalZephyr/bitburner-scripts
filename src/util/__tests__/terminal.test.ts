import { describe, expect, test } from '@jest/globals';

import { hasUnfinishedTimerBar, splitAtTimedCommands } from 'util/terminal';

describe('splits commands list at timed commands', () => {
    test('untimed commands are not split', () => {
        expect(splitAtTimedCommands('connect foo')).toStrictEqual([
            'connect foo',
        ]);
        expect(
            splitAtTimedCommands('connect foo ; home ; scp thing'),
        ).toStrictEqual(['connect foo ; home ; scp thing']);
    });

    test.each(['analyze', 'backdoor', 'grow', 'hack', 'weaken'])(
        'single timed commands are not split',
        (timedFn) => {
            expect(splitAtTimedCommands(timedFn)).toStrictEqual([timedFn]);
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
});

describe('match timer bar patterns', () => {
    test('unstarted progress bar', () => {
        expect(hasUnfinishedTimerBar('[-]')).toBeTruthy();
        expect(hasUnfinishedTimerBar('[--]')).toBeTruthy();
        expect(hasUnfinishedTimerBar('[-------------------]')).toBeTruthy();
    });

    test('in-progress bar', () => {
        expect(hasUnfinishedTimerBar('[|-]')).toBeTruthy();
        expect(hasUnfinishedTimerBar('[|----------------------]')).toBeTruthy();
        expect(hasUnfinishedTimerBar('[|||||||||||------------]')).toBeTruthy();
        expect(hasUnfinishedTimerBar('[||||||||||||||||||||||-]')).toBeTruthy();
    });

    test('finished progress bar', () => {
        expect(hasUnfinishedTimerBar('[|]')).toBeFalsy();
        expect(hasUnfinishedTimerBar('[||||]')).toBeFalsy();
        expect(hasUnfinishedTimerBar('[||||||||||||||||||]')).toBeFalsy();
    });

    test("doesn't match other similar patterns", () => {
        expect(hasUnfinishedTimerBar('[]')).toBeFalsy();
        expect(hasUnfinishedTimerBar('[abc]')).toBeFalsy();
        expect(hasUnfinishedTimerBar('[123]')).toBeFalsy();
        expect(hasUnfinishedTimerBar('[-|]')).toBeFalsy();
        expect(hasUnfinishedTimerBar('[--||]')).toBeFalsy();
        expect(hasUnfinishedTimerBar('[-----|]')).toBeFalsy();
        expect(hasUnfinishedTimerBar('[-|||||]')).toBeFalsy();
    });
});
