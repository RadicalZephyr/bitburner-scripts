import { makeFuid } from 'util/fuid';
export function exitOnKill(ns) {
    return new Promise((resolve) => {
        ns.atExit(() => {
            resolve();
        }, `exitOnKill-${makeFuid(ns)}`);
    });
}
