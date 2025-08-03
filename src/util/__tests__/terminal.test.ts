import { hasTimerBar } from 'util/terminal';

describe('match timer bar patterns', () => {
    test('unstarted progress bar', () => {
        expect(hasTimerBar('[-]')).toBeTruthy();
        expect(hasTimerBar('[--]')).toBeTruthy();
        expect(hasTimerBar('[-------------------]')).toBeTruthy();
    });

    test('in-progress bar', () => {
        expect(hasTimerBar('[|-]')).toBeTruthy();
        expect(hasTimerBar('[|----------------------]')).toBeTruthy();
        expect(hasTimerBar('[|||||||||||------------]')).toBeTruthy();
        expect(hasTimerBar('[||||||||||||||||||||||-]')).toBeTruthy();
    });

    test('finished progress bar', () => {
        expect(hasTimerBar('[|]')).toBeTruthy();
        expect(hasTimerBar('[||||]')).toBeTruthy();
        expect(hasTimerBar('[||||||||||||||||||]')).toBeTruthy();
    });

    test("doesn't match other similar patterns", () => {
        expect(hasTimerBar('[abc]')).toBeFalsy();
        expect(hasTimerBar('[123]')).toBeFalsy();
    });
});
