import { sleep } from 'util/time';

/**
 * Send a command to the game terminal, simulating user input.
 */
export async function sendTerminalCommand(command: string) {
    // Acquire a reference to the terminal text field
    const terminalInput = globalThis['terminal-input'];
    if (!(terminalInput instanceof HTMLInputElement)) return;

    terminalInput.value = command;

    // Get a reference to the React event handler.
    const handler = Object.keys(terminalInput)[1];

    // Perform an onChange event to set some internal values.
    terminalInput[handler].onChange({ target: terminalInput });

    // Simulate an enter press
    terminalInput[handler].onKeyDown({
        key: 'Enter',
        preventDefault: (): void => null,
    });

    await sleep(0);
    const terminalOutput = globalThis['terminal'];
    if (!(terminalOutput instanceof Element)) return;

    let lastTermOut = terminalOutput.lastElementChild;
    while (lastTermOut && hasTimerBar(lastTermOut.innerHTML)) {
        await sleep(100);
        lastTermOut = terminalOutput.lastElementChild;
    }
}

/**
 * Search a string for the presence of the ASCII timer progress bar.
 *
 * @remarks
 *
 * Should match against the ASCII progress bar timed terminal commands
 * display:
 *
 * `[-----------]`
 * `[||||||-----]`
 * `[|||||||||||]`
 *
 * @param haystack - string to search for timer bar pattern
 * @returns whether the pattern is present or not.
 */
export function hasTimerBar(haystack: string): boolean {
    const timer_re = /\[\|*-*]/;
    return timer_re.test(haystack);
}

/**
 * Send a manual grow command in the terminal.
 */
export async function manualGrow() {
    await sendTerminalCommand('grow');
}

/**
 * Send a manual weaken command in the terminal.
 */
export async function manualWeaken() {
    await sendTerminalCommand('weaken');
}
