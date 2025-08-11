import { getReactPropKey } from 'util/props';
import { sleep } from 'util/time';

/**
 * Options for customizing how your terminal command runs.
 */
interface TerminalOptions {
    /**
     * Whether to wait until completion of the command.
     *
     * Default: true
     */
    waitForCompletion?: boolean;

    /**
     * How long to wait for the command to be sent.
     *
     * Default: 100 milliseconds
     */
    commandEnteredTimeoutMs?: number;

    /**
     * Interval to check the last terminal output at for a timer bar
     * to determine when command has finished. This option has no
     * effect if `waitForCompletion` is false.
     *
     * Default: 100 milliseconds
     */
    pollIntervalMs?: number;
}

const defaultOptions: TerminalOptions = {
    waitForCompletion: true,
    commandEnteredTimeoutMs: 100,
    pollIntervalMs: 100,
};

/**
 * Send a command to the game terminal, simulating user input.
 *
 * @param command - text command to run
 */
export async function sendTerminalCommand(
    command: string,
    options: TerminalOptions = defaultOptions,
) {
    return withTerminalLock(async () => {
        // Acquire a reference to the terminal text field
        const terminalInput = assertEl(
            globalThis['terminal-input'],
            'could not find terminal input element!',
        );

        terminalInput.value = command;

        // Get a reference to the React event handler.
        const propKey = getReactPropKey(terminalInput);

        // Perform an onChange event to set some internal values.
        terminalInput[propKey].onChange({ target: terminalInput });

        // Acquire a reference to the terminal output list
        const terminalOutput = assertEl(
            globalThis['terminal'],
            'could not find terminal output element!',
        );

        // Create the observer before we send the 'Enter' event
        const commandEntered = waitForNextTerminalLine(
            terminalOutput,
            command,
            options.commandEnteredTimeoutMs,
        );

        // Simulate an enter press
        terminalInput[propKey].onKeyDown({
            key: 'Enter',
            preventDefault: (): void => null,
        });

        // Wait for our command to appear in the output
        await commandEntered;

        if (options.waitForCompletion)
            await waitForTimerBarToFinish(
                terminalOutput,
                options.pollIntervalMs,
            );
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let terminalLock: Promise<any> = Promise.resolve();

function withTerminalLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = terminalLock.then(fn, fn);
    // keep chain alive
    terminalLock = run.catch((reason) => {
        console.log(reason);
    });
    return run;
}

function assertEl<T extends Element>(el: T | null | undefined, msg: string): T {
    if (!el) throw new Error(msg);
    return el;
}

function waitForNextTerminalLine(
    container: Element,
    command: string,
    timeoutMs: number,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const deadline = setTimeout(() => {
            observer.disconnect();
            reject(new Error('Timed out waiting for terminal output'));
        }, timeoutMs);

        const observer = new MutationObserver(
            (mutations: MutationRecord[], observer: MutationObserver) => {
                for (const record of mutations) {
                    record.addedNodes.forEach((node: Node) => {
                        if (node.textContent?.endsWith(command)) {
                            clearTimeout(deadline);
                            observer.disconnect();
                            resolve();
                        }
                    });
                }
            },
        );

        observer.observe(container, { childList: true });
    });
}

async function waitForTimerBarToFinish(
    container: Element,
    pollIntervalMs: number,
) {
    let lastTermOut = container.lastElementChild;
    while (lastTermOut && hasTimerBar(lastTermOut.textContent ?? '')) {
        await sleep(pollIntervalMs);
        lastTermOut = container.lastElementChild;
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
    const timer_re = /\[(-+|\|+-*)]/;
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
