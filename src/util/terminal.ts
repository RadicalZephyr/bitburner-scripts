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
    while (lastTermOut && hasTimerBar(lastTermOut)) {
        await sleep(100);
        lastTermOut = terminalOutput.lastElementChild;
    }
}

function hasTimerBar(el: Element): boolean {
    // Should match against the ASCII progress bar timed terminal commands display:
    // `[-----------]`
    // `[||||||-----]`
    // `[|||||||||||]`
    const timer_re = /\[\|*-*]/;
    return timer_re.test(el.innerHTML);
}
