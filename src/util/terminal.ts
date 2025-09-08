import type { NS } from 'netscript';

import { assertEl } from 'util/assertEl';
import { getReactPropKey } from 'util/props';
import { sleep } from 'util/time';

/**
 * Options for customizing how your terminal command runs.
 */
export interface TerminalOptions {
    /**
     * Additional time to sleep for timed commands to ensure that the
     * command has finished.
     *
     * Default: 100 milliseconds
     * Minimum value: 10 milliseconds
     */
    actionBufferMs?: number;

    /**
     * How long to wait for the command to be sent.
     *
     * Default: Wait forever
     */
    commandTimeoutMs?: number;
}

const DEFAULT_OPTIONS: TerminalOptions = {
    actionBufferMs: 100,
    commandTimeoutMs: 0,
};

/**
 * Send a command to the Bitburner terminal by simulating user input.
 *
 * This helper is designed to be **safe** and **deterministic** when multiple scripts
 * try to talk to the terminal:
 *
 * - **Waits for the terminal input** to be available the Terminal page must be visible.
 * - **Waits for timed commands to complete** by sleeping for the appropriate amount of time.
 * - **Serializes access** to the terminal via an internal lock so commands from different
 *   callers do not interleave. Calls are queued in the order invoked.
 *
 * @remarks
 * - “Timed” commands end detection is calculated according to game
 *   internals based on the server the terminal is currently visiting.
 *   Commands that do not produce a timer bar will resolve immediately
 *   after the command is sent.
 * - Calls are **serialized process-wide** (tab-wide) by an internal promise queue.
 *   You can “enqueue” several commands by calling this function without awaiting them,
 *   then `await` a final call to flush the queue (see examples).
 * - This implementation reaches into Bitburner’s UI/React internals. If the game’s
 *   UI changes, you may need to update the DOM lookup or React-prop access.
 *
 * @param command - The exact terminal command to send.
 *
 * You may chain multiple commands with `;` (e.g. `"home ; connect
 * foodnstuff ; ./NUKE.exe ; hack"`).
 *
 * Timed commands (analyze, backdoor, grow, hack, or weaken) will be
 * split into separate commands so the timer can be properly awaited.
 *
 * @param options - Optional behavior controls.
 *
 *   - `actionBufferMs` (default: `100`, minimum: `10`): additional time to wait to ensure timed commands are complete.
 *   - `commandTimeoutMs` (default: `0`): how long to wait for the terminal element to become available before rejecting.
 *
 * @returns A promise that resolves with a list of commands that were sent when:
 *   1) the command was sent to the terminal
 *   2) if the command is timed, waits until the timed command finishes.
 *
 * @throws If the terminal-input element isn't an `HTMLInputElement`
 *
 * @example
 * // Basic usage: send a chained command and wait until any timed part completes
 * await sendTerminalCommand(ns, "home ; connect foodnstuff ; ./NUKE.exe ; hack");
 *
 * @example
 * // Fire-and-queue: enqueue several commands WITHOUT awaiting, then await a final call.
 * // The internal lock guarantees these execute in order with no interleaving from other scripts.
 * sendTerminalCommand(ns, "home");
 * sendTerminalCommand(ns, "connect foodnstuff");
 * sendTerminalCommand(ns, "./NUKE.exe");
 * sendTerminalCommand(ns, "hack");
 * await sendTerminalCommand(ns, "home"); // awaits completion of all prior queued commands
 *
 * @example
 * // Add a command timeout if we want the script to end if the terminal is unavailable for more than 2 seconds
 * await sendTerminalCommand(ns, "home", { commandTimeoutMs: 2000 });
 *
 * @example
 * // Tighter action buffer if you want faster command throughput
 * sendTerminalCommand(ns, 'hack', { actionBufferMs: 10 })
 * sendTerminalCommand(ns, 'grow', { actionBufferMs: 10 })
 * sendTerminalCommand(ns, 'weaken', { actionBufferMs: 10 })
 * await sendTerminalCommand(ns, 'weaken', { actionBufferMs: 10 })
 */
export function sendTerminalCommand(
    ns: NS,
    command: string,
    options: TerminalOptions = {},
): Promise<string[]> {
    const o = {
        ...DEFAULT_OPTIONS,
        ...options,
    };
    // Enforce minimum action buffer time
    o.actionBufferMs = Math.max(10, o.actionBufferMs);

    const sequenceOfCommands = splitAtTimedCommands(command);
    const promises: Promise<string>[] = [];
    for (const c of sequenceOfCommands) {
        promises.push(
            withTerminalLock(() => sendOneTimedTerminalCommand(ns, c, o)),
        );
    }
    return Promise.all(promises);
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
    const next = terminalLock.then(fn, fn);
    // We only log errors here because we need to avoid throwing so
    // queued calls still get executed even if one fails.
    terminalLock = next.catch((reason) => {
        console.error(reason);
    });
    return next;
}

async function sendOneTimedTerminalCommand(
    ns: NS,
    command: string,
    opts: TerminalOptions,
): Promise<string> {
    // N.B. the minimum is enforced by `sendTerminalCommand`
    const { actionBufferMs } = opts;

    // Find terminal input, waiting for it to appear if the player has
    // it hidden.
    const terminalInput = await findTerminalInput(ns, opts.commandTimeoutMs);

    // Trigger event handlers to set component state for new
    // command and simulate hitting 'Enter'
    dispatchReactInputAndEnter(terminalInput, command);

    // after input
    if (isTimedCommand(command)) {
        const server = getHostFromPrompt(terminalInput);
        const ms = expectedMillisFor(ns, server, command);
        await sleep(ms + actionBufferMs);
    }

    return command;
}

/**
 * Find the terminal input element within a time limit.
 *
 * Waits until the terminal input element is on-screen or the timeout expires.
 *
 * If the timeout is zero then it will wait indefinitely.
 *
 * @param ns        - Netscript API instance
 * @param timeoutMs - Maximum time to wait for the terminal input element, in milliseconds.
 * @returns {HTMLInputElement} The terminal input element
 *
 * @throws If the terminal-input element isn't an `HTMLInputElement` or the timeout expires
 */
export async function findTerminalInput(
    ns: NS,
    timeoutMs = DEFAULT_OPTIONS.commandTimeoutMs,
): Promise<HTMLInputElement> {
    let termInputEl: unknown | null;
    const start = Date.now();

    while (true) {
        termInputEl = globalThis['terminal-input'] as unknown;
        if (termInputEl) break;
        if (timeoutMs > 0 && Date.now() > start + timeoutMs)
            throw new Error(
                `Timed out after ${timeoutMs}ms waiting for terminal input`,
            );
        await ns.asleep(100);
    }

    if (!(termInputEl instanceof HTMLInputElement))
        throw new Error("Found terminal input but it wasn't an input element!");

    return termInputEl;
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

    // NOTE: it's important to fetch this `onKeyDown` property
    // starting from the terminalInput element after updating the
    // value because React v17.0.2 actually sets a new property object
    // when that happens, not just a new `onKeyDown` handler. This
    // handler closes over the state value, so even though the value
    // is updated you need to get the new handler for the new value to
    // be used.
    terminalInput[propKey].onKeyDown({
        key: 'Enter',
        preventDefault: (): void => null,
    });
}

function expectedMillisFor(ns: NS, currentServer: string, cmd: string): number {
    const m = cmd.trim().split(/\s+/);
    const verb = m[0].toLowerCase();

    // Terminal command times are related to script times, just faster
    // Factors mirror Terminal action speeds found in Bitburner source
    // under `src/Terminal/Terminal.ts`, look for usages of
    // `this.startAction()`.
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

function getHostFromPrompt(terminalInput: Element): string {
    const promptEl = assertEl(
        terminalInput.previousElementSibling,
        'Could not find terminal prompt element.',
    );

    const promptText = promptEl.textContent ?? '';

    const nonHostRE = /[^\w.-]+/g;
    return promptText.replaceAll(nonHostRE, '');
}

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
