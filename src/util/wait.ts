import type { NS } from 'netscript';

export async function waitForExit(ns: NS, pid: number): Promise<void> {
    while (true) {
        await ns.asleep(100);
        if (!ns.isRunning(pid)) {
            break;
        }
    }
}
