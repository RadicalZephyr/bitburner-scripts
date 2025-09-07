import type { NS } from 'netscript';

import { makeFuid } from 'util/fuid';

export function exitOnKill(ns: NS): Promise<void> {
    return new Promise((resolve) => {
        ns.atExit(
            () => {
                resolve();
            },
            `exitOnKill-${makeFuid(ns)}`,
        );
    });
}
