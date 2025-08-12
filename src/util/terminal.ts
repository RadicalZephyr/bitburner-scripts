import { getReactPropKey } from 'util/props';
import { sleep } from 'util/time';

/**
 * Options for customizing how your terminal command runs.
 */
export interface TerminalOptions {
    /**
     * Whether to wait until completion of the command.
     *
     * Default: true
     */
    waitForCompletion?: boolean;

    /**
     * How long to wait for the command to be sent.
     *
     * Default: 1 second
     */
    commandEchoTimeoutMs?: number;

    /**
     * How long to wait for the timer bar to start. This option has no
     * effect if `waitForCompletion` is false.
     *
     * Default: 100 milliseconds
     */
    startTimeoutMs?: number;

    /**
     * Interval to check the last terminal output at for a timer bar
     * to determine when command has finished. This option has no
     * effect if `waitForCompletion` is false.
     *
     * Default: 100 milliseconds
     * Minimum: 10 milliseconds
     */
    pollIntervalMs?: number;
}

const DEFAULT_OPTIONS: TerminalOptions = {
    waitForCompletion: true,
    commandEchoTimeoutMs: 1000,
    startTimeoutMs: 1000,
    pollIntervalMs: 100,
};

/**
 * Send a command to the Bitburner terminal by simulating user input.
 *
 * This helper is designed to be **safe** and **deterministic** when multiple scripts
 * try to talk to the terminal:
 *
 * - **Waits for the command to appear in terminal output** (with a timeout).
 * - **Optionally waits for timed commands to complete** by watching the ASCII timer bar.
 * - **Serializes access** to the terminal via an internal lock so commands from different
 *   callers do not interleave. Calls are queued in the order invoked.
 *
 * @remarks
 * - The function uses DOM observation to detect when the command has been echoed
 *   and (optionally) when a timed operation completes.
 * - “Timed” detection relies on the terminal’s ASCII progress bar (e.g. `[||||---]`).
 *   Commands that do not produce a timer bar will resolve immediately after echo.
 * - Calls are **serialized process-wide** (tab-wide) by an internal promise queue.
 *   You can “enqueue” several commands by calling this function without awaiting them,
 *   then `await` a final call to flush the queue (see examples).
 * - This implementation reaches into Bitburner’s UI/React internals. If the game’s
 *   UI changes, you may need to update the DOM lookup or React-prop access.
 *
 * @param command - The exact terminal command to run.
 *
 * You may chain multiple commands with `;` (e.g. `"home ; connect
 * foodnstuff ; run NUKE.exe ; hack"`).
 *
 * Timed commands (analyze, backdoor, grow, hack, or weaken) will be
 * split into separate commands so the timer can be properly awaited.
 *
 * @param options - Optional behavior controls.
 *
 *   - `waitForCompletion` (default: `true`): if `true`, waits for a visible timer bar to disappear.
 *   - `commandEchoTimeoutMs` (default: `1000`): how long to wait for the command echo to appear
 *      in the terminal before rejecting.
 *   - `pollIntervalMs` (default: `100`): interval used when watching the timer bar (only when
 *      `waitForCompletion` is `true`).
 *
 * @returns A promise that resolves when:
 *   1) the command echo appears (always), and
 *   2) if `waitForCompletion === true`, any visible timer bar finishes.
 *   The promise rejects on timeout or if the terminal DOM cannot be found.
 *
 * @throws
 * - `Error("Could not find terminal input element!")` or
 *   `Error("Could not find terminal output element!")` if the UI elements are missing.
 * - `Error("Timed out waiting for terminal output")` if the command echo does not appear
 *   within `commandEchoTimeoutMs`.
 *
 * @example
 * // Basic usage: run a chained command and wait until any timed part completes
 * await sendTerminalCommand("home ; connect foodnstuff ; run NUKE.exe ; hack");
 *
 * @example
 * // Fire-and-queue: enqueue several commands WITHOUT awaiting, then await a final call.
 * // The internal lock guarantees these execute in order with no interleaving from other scripts.
 * sendTerminalCommand("home");
 * sendTerminalCommand("connect foodnstuff");
 * sendTerminalCommand("run NUKE.exe");
 * sendTerminalCommand("hack");
 * await sendTerminalCommand("home"); // awaits completion of all prior queued commands
 *
 * @example
 * // Skip waiting for long actions (just ensure the command was entered)
 * await sendTerminalCommand("grow", { waitForCompletion: false });
 *
 * @example
 * // Tighter timeout if you expect an immediate echo or want fast failure
 * await sendTerminalCommand("home", { commandEchoTimeoutMs: 200 });
 */
export function sendTerminalCommand(
    command: string,
    options: TerminalOptions = {},
): Promise<void> {
    const o = {
        ...DEFAULT_OPTIONS,
        ...options,
    };
    // Enforce minimum poll interval
    o.pollIntervalMs = Math.max(o.pollIntervalMs, 10);

    const sequenceOfCommands = tokenize(command);
    let p: Promise<void> = Promise.resolve();
    for (const c of sequenceOfCommands) {
        p = withTerminalLock(
            async () => await sendOneTimedTerminalCommand(c, o),
        );
    }
    return p;
}

const TIMED_COMMANDS: RegExp = /^(analyze|backdoor|grow|hack|weaken)\b/i;

export function tokenize(commands: string): string[] {
    return commands
        .split(';')
        .map((c) => c.trim())
        .filter((s) => s.length !== 0);
}

let SEQ = 0;
function now() {
    return performance.now().toFixed(1);
}

async function sendOneTimedTerminalCommand(
    command: string,
    opts: TerminalOptions,
) {
    const {
        waitForCompletion,
        commandEchoTimeoutMs,
        startTimeoutMs,
        pollIntervalMs,
    } = opts;

    const id = SEQ++;
    console.log(`[${id}] @${now()} start ${JSON.stringify({ command, opts })}`);

    // Acquire a reference to the terminal text field
    const terminalInput = assertEl(
        globalThis['terminal-input'],
        'Could not find terminal input element!',
        (el) => el instanceof HTMLInputElement,
    );

    // Acquire a reference to the terminal output list
    const terminalOutput = assertEl(
        globalThis['terminal'],
        'Could not find terminal output element!',
    );

    // Create the observer before we send the 'Enter' event
    const commandEchoed = waitForCommandEcho(
        terminalOutput,
        command,
        commandEchoTimeoutMs,
    );

    // Trigger event handlers to set component state for new
    // command and simulate hitting 'Enter'
    dispatchReactInputAndEnter(terminalInput, command);

    console.log(
        `[${id}] @${now()} echo-wait begin (window=${commandEchoTimeoutMs})`,
    );
    // Wait for our command to appear in the output
    await commandEchoed;
    console.log(`[${id}] @${now()} echo-wait end`);

    if (waitForCompletion) {
        console.log(
            `[${id}] @${now()} timer-start begin (window=${startTimeoutMs})`,
        );
        const sawTimer = await waitForTimerBarToStart(
            terminalOutput,
            startTimeoutMs,
            pollIntervalMs,
        );
        console.log(
            `[${id}] @${now()} timer-start end ${sawTimer ? 'SEEN' : 'NOT SEEN'}`,
        );

        if (sawTimer) {
            console.log(
                `[${id}] @${now()} timer-finish begin (pollInterval=${pollIntervalMs})`,
            );
            await waitForTimerBarToFinish(terminalOutput, pollIntervalMs);
            console.log(`[${id}] @${now()} timer-finish end`);
        } else {
            console.log(`[${id}] @${now()} no timer detected; continuing`);
        }
    }
}

let terminalLock: Promise<unknown> = Promise.resolve();

/**
 * Chains promises so only one terminal command runs at a time.
 */
function withTerminalLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = terminalLock.then(fn, fn);
    // We only log errors here because we need to avoid throwing so
    // queued calls still get executed even if one fails.
    terminalLock = run.catch((reason) => {
        console.error(reason);
    });
    return run;
}

type GuardFn<T> = (el: unknown) => el is T;

const isElement: GuardFn<Element> = (el: unknown) => {
    return el instanceof Element;
};

/**
 * Throws an error if the element is null.
 */
function assertEl(el: unknown, msg: string): Element;
function assertEl<T extends Element>(
    el: unknown,
    msg: string,
    guard: GuardFn<T>,
): T;
function assertEl<T extends Element>(
    el: unknown,
    msg: string,
    guard?: GuardFn<T>,
): T {
    const g = guard ?? (isElement as GuardFn<T>);
    if (!(el != null && g(el))) throw new Error(msg);
    return el;
}

/**
 * Trigger React event handlers so terminal sees the new command and runs it.
 */
function dispatchReactInputAndEnter(
    terminalInput: HTMLInputElement,
    command: string,
) {
    // Set the input text to our command.
    terminalInput.value = command;

    // Get a reference to the React event handler.
    const propKey = getReactPropKey(terminalInput);

    // Perform an onChange event to set some internal values.
    terminalInput[propKey].onChange({ target: terminalInput });

    // Simulate an enter press
    terminalInput[propKey].onKeyDown({
        key: 'Enter',
        preventDefault: (): void => null,
    });
}

/**
 * Watches the terminal output for our command to appear.
 */
function waitForCommandEcho(
    container: Element,
    command: string,
    timeoutMs: number,
): Promise<void> {
    const initialLastContent = container.lastElementChild?.textContent ?? '';
    return new Promise((resolve, reject) => {
        const deadline = setTimeout(() => {
            observer.disconnect();
            const currentLastContent =
                container.lastElementChild?.textContent ?? '';
            // If last terminal output is the same, fail
            if (initialLastContent == currentLastContent)
                reject(new Error(`Timed out waiting for echo of ${command}`));
            else resolve();
        }, timeoutMs);

        const observer = new MutationObserver(() => {
            const last = container.lastElementChild;
            if (!last) return;

            const tail = [last];
            for (const el of tail) {
                const contents = el?.textContent ?? '';
                if (contents.trim().endsWith(command.trim())) {
                    clearTimeout(deadline);
                    observer.disconnect();
                    resolve();
                    return;
                }
            }
        });

        // We observe the whole container because the terminal may add
        // new children, update text or replace the last line element.
        observer.observe(container, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    });
}

/**
 * Examines terminal output for timer bar and waits for one to appear.
 */
async function waitForTimerBarToStart(
    container: Element,
    startTimeoutMs: number,
    pollIntervalMs: number,
): Promise<boolean> {
    let done = false;
    const deadline = setTimeout(() => {
        if (done) return;
        done = true;
    }, startTimeoutMs);

    let lastTermOut = container.lastElementChild;
    while (!done && lastTermOut) {
        if (hasUnfinishedTimerBar(lastTermOut.textContent ?? '')) {
            done = true;
            clearTimeout(deadline);
            return true;
        }
        await sleep(pollIntervalMs);
        lastTermOut = container.lastElementChild;
    }

    return false;
}

/**
 * Examines terminal output for a timer bar and waits for it to
 * complete.
 */
async function waitForTimerBarToFinish(
    container: Element,
    pollIntervalMs: number,
) {
    let lastTermOut = container.lastElementChild;
    while (
        lastTermOut
        && hasUnfinishedTimerBar(lastTermOut.textContent ?? '')
    ) {
        await sleep(pollIntervalMs);
        lastTermOut = container.lastElementChild;
    }
}

/**
 * Search a string for the presence of an unfinished ASCII timer
 * progress bar.
 *
 * @remarks
 *
 * Should match against the ASCII progress bar timed terminal commands
 * display:
 *
 * `[-----------]`
 * `[||||||-----]`
 *
 * Finished ASCII progress bars will return false
 *
 * `[|||||||||||]`
 *
 * @param haystack - string to search for timer bar pattern
 * @returns whether the pattern is present or not.
 */
export function hasUnfinishedTimerBar(haystack: string): boolean {
    const timer_re = /\[(-+|\|+-+)]/;
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
