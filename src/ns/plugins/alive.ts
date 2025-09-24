import type { NS } from '@ns';

import { namespaced } from 'ns/namespace';

export const alivePlugin = (ns: NS) =>
    namespaced('alive', {
        name: 'alive',
        setup(ns, { onExit, signal }) {
            let alive = true;
            onExit(() => {
                alive = false;
            });

            const untilKilled = (): Promise<void> =>
                alive
                    ? new Promise<void>((res) => {
                          const h = () => {
                              signal.removeEventListener('abort', h);
                              res();
                          };
                          signal.addEventListener('abort', h, { once: true });
                      })
                    : Promise.resolve();

            async function* loop(
                interval = 0,
            ): AsyncGenerator<void, void, void> {
                while (alive) {
                    yield;
                    if (!alive) break;
                    if (interval > 0) await ns.sleep(interval);
                    else await ns.asleep(0);
                }
            }

            return {
                /** True until the script is killed (zero RAM; custom). */
                isAlive: () => alive,
                /** Resolves when killed. */
                untilKilled,
                /** AbortSignal that fires on kill. */
                signal,
                /** Async generator that ticks until killed. */
                loop,
            };
        },
    });
