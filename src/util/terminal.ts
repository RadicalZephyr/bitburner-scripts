import type { NS } from 'netscript';

import { getReactPropKey } from 'util/props';
import { sleep } from 'util/time';

/**
 * Options for customizing how your terminal command runs.
 */
export interface TerminalOptions {
    /**
     * How long to wait for the command to be sent.
     *
     * Default: 500 milleseconds
     */
    commandEchoTimeoutMs?: number;

    /**
     * Whether to wait until completion of the command.
     *
     * Default: true
     */
    waitForCompletion?: boolean;
}

const DEFAULT_OPTIONS: TerminalOptions = {
    commandEchoTimeoutMs: 500,
    waitForCompletion: true,
};

/**
 * Send a command to the Bitburner terminal by simulating user input.
 *
 * This helper is designed to be **safe** and **deterministic** when multiple scripts
 * try to talk to the terminal:
 *
 * - **Waits for the command to appear in terminal output** (with a timeout).
 * - **Optionally waits for timed commands to complete** by sleeping for the appropriate amount of time.
 * - **Serializes access** to the terminal via an internal lock so commands from different
 *   callers do not interleave. Calls are queued in the order invoked.
 *
 * @remarks
 * - The function uses DOM observation to detect when the command has been echoed.
 * - “Timed” commands end detection is calculated according to game internals based on targeted server.
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
 *   - `commandEchoTimeoutMs` (default: `500`): how long to wait for the command echo to appear in the terminal before rejecting.
 *   - `waitForCompletion` (default: `true`): if `true`, waits for a visible timer bar to disappear.
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
 * await sendTerminalCommand(ns, "home ; connect foodnstuff ; run NUKE.exe ; hack");
 *
 * @example
 * // Fire-and-queue: enqueue several commands WITHOUT awaiting, then await a final call.
 * // The internal lock guarantees these execute in order with no interleaving from other scripts.
 * sendTerminalCommand(ns, "home");
 * sendTerminalCommand(ns, "connect foodnstuff");
 * sendTerminalCommand(ns, "run NUKE.exe");
 * sendTerminalCommand(ns, "hack");
 * await sendTerminalCommand(ns, "home"); // awaits completion of all prior queued commands
 *
 * @example
 * // Skip waiting for long actions (just ensure the command was entered)
 * await sendTerminalCommand(ns, "grow", { waitForCompletion: false });
 *
 * @example
 * // Tighter timeout if you expect an immediate echo or want fast failure
 * await sendTerminalCommand(ns, "home", { commandEchoTimeoutMs: 200 });
 */
export function sendTerminalCommand(
    ns: NS,
    command: string,
    options: TerminalOptions = {},
): Promise<void> {
    const o = {
        ...DEFAULT_OPTIONS,
        ...options,
    };

    const sequenceOfCommands = splitAtTimedCommands(command);
    let p: Promise<void> = Promise.resolve();
    for (const c of sequenceOfCommands) {
        p = withTerminalLock(
            async () => await sendOneTimedTerminalCommand(ns, c, o),
        );
    }
    return p;
}

/**
 * Split a command string at known timed commands.
 *
 * @param commands - String containing terminal commands, possibly chained with `;`
 * @returns A list of strings of commands where timed commands have been separated from other commands.
 */
export function splitAtTimedCommands(commands: string): string[] {
    const finalCommands = [];
    const commandTokens = tokenize(commands);

    let currentCommand = '';
    let sep = '';
    for (const t of commandTokens) {
        if (isTimedCommand(t)) {
            if (currentCommand !== '') finalCommands.push(currentCommand);
            finalCommands.push(t);
            currentCommand = '';
            sep = '';
        } else {
            currentCommand += sep + t;
            sep = ' ; ';
        }
    }

    if (currentCommand !== '') finalCommands.push(currentCommand);

    return finalCommands;
}

function isTimedCommand(command: string): boolean {
    const TIMED_COMMANDS: RegExp = /^(analyze|backdoor|grow|hack|weaken)\b/i;
    return TIMED_COMMANDS.test(command);
}

export function tokenize(commands: string): string[] {
    return commands
        .split(';')
        .map((c) => c.trim())
        .filter((s) => s.length !== 0);
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

async function sendOneTimedTerminalCommand(
    ns: NS,
    command: string,
    opts: TerminalOptions,
) {
    const { commandEchoTimeoutMs, waitForCompletion } = opts;

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

    // Wait for our command to appear in the output
    await commandEchoed;

    // after echo
    if (isTimedCommand(command) && waitForCompletion) {
        await sleep(
            expectedMillisFor(ns, getCurrentServer(terminalInput), command),
        );
    }
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

            const tail = [last.previousElementSibling, last];
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

function expectedMillisFor(ns: NS, currentServer: string, cmd: string): number {
    const m = cmd.trim().split(/\s+/);
    const verb = m[0].toLowerCase();

    // Terminal command times are related to script times, just faster
    switch (verb) {
        case 'hack':
            return ns.getHackTime(currentServer) / 4;
        case 'grow':
            return ns.getGrowTime(currentServer) / 16;
        case 'weaken':
            return ns.getWeakenTime(currentServer) / 16;
        case 'backdoor':
            return ns.getHackTime(currentServer) / 4; // backdoor and hack take the same time
        case 'analyze':
            return 1000; // analyze is the same for all servers, 1 second
        default:
            return 0;
    }
}

function getCurrentServer(terminalInput: Element): string {
    const promptEl = assertEl(
        terminalInput.previousElementSibling,
        'Could not find terminal prompt element.',
    );

    const promptText = promptEl.textContent ?? '';

    const nonHostRE = /[^\w.-]+/g;
    return promptText.replaceAll(nonHostRE, '');
}

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

const isElement: GuardFn<Element> = (el: unknown) => {
    return el instanceof Element;
};

/**
 * Send a manual grow command in the terminal.
 */
export async function manualGrow(ns: NS) {
    await sendTerminalCommand(ns, 'grow');
}

/**
 * Send a manual weaken command in the terminal.
 */
export async function manualWeaken(ns: NS) {
    await sendTerminalCommand(ns, 'weaken');
}
