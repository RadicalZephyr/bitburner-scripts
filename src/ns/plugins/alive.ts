import { namespaced } from 'ns/namespace';

export const alivePlugin = () =>
    namespaced('alive', {
        name: 'alive',
        setup(ns, { signal }) {
            // One promise forever: resolves exactly once when the script is being killed
            const killed: Promise<void> = signal.aborted
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                      // Resolve when our shared AbortSignal fires.
                      // `once: true` guarantees the handler runs a single time.
                      signal.addEventListener('abort', () => resolve(), {
                          once: true,
                      });
                  });

            async function* loop(
                interval = 0,
            ): AsyncGenerator<void, void, void> {
                while (!signal.aborted) {
                    yield;
                    if (signal.aborted) break;
                    if (interval > 0)
                        await Promise.race([killed, ns.asleep(interval)]);
                    else await Promise.race([killed, ns.asleep(0)]);
                }
            }

            return {
                /** True until the script is killed (zero RAM; custom). */
                isAlive: () => !signal.aborted,
                /** Resolves when killed. */
                untilKilled: () => killed,
                /** AbortSignal that fires on kill. */
                signal,
                /** Async generator that ticks until killed. */
                loop,
            };
        },
    });
