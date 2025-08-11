import { hasUnfinishedTimerBar } from 'util/terminal';

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
