// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SetInterval = (handler: TimerHandler, timeout?: number, ...args: any[]) => number;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SetTimeout = (handler: TimerHandler, timeout?: number, ...args: any[]) => number;

/**
 * Sleep for at least ms milliseconds.
 *
 * @param ms - Number of milliseconds to sleep for
 * @returns A Promise that resolves after the sleep has elapsed
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(res => globalThis.setTimeout(() => res.call(null), ms));
}

/**
 * Repeatedly calls a function or executes a code snippet, with a
 * fixed time delay between each call.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/setInterval)
 *
 * @param handler - A function to be executed after the timer expires.
 * @param timeout - The time, in milliseconds that the timer should wait before the specified function is executed. If this parameter is omitted, a value of 0 is used, meaning execute "immediately", or more accurately, the next event cycle.
 * @param args    - Arguments to pass to the function
 */
export const setInterval: SetInterval = globalThis.setInterval;


/**
 * Sets a timer which executes a function or specified piece of code
 * once the timer expires.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/setTimeout)
 *
 * @param handler - A function to be executed after the timer expires.
 * @param timeout - The time, in milliseconds that the timer should wait before the specified function is executed. If this parameter is omitted, a value of 0 is used, meaning execute "immediately", or more accurately, the next event cycle.
 * @param args    - Arguments to pass to the function
 */
export const setTimeout: SetTimeout = globalThis.setTimeout;
