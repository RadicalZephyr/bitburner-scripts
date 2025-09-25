import { namespaced } from 'ns/namespace';

export const loggerPlugin = () =>
    namespaced('log', {
        name: 'logger',
        setup(ns, { onExit }) {
            let open = true;
            onExit(() => {
                open = false;
            });
            return {
                info: (...a: unknown[]) => {
                    if (open) ns.print('INFO', ...a);
                },
                warn: (...a: unknown[]) => {
                    if (open) ns.print('WARN', ...a);
                },
                error: (...a: unknown[]) => {
                    if (open) ns.print('ERROR', ...a);
                },
            };
        },
    });
