import type { NS } from "netscript";

export async function waitForExit(ns: NS, pid: number): Promise<void> {
    while (true) {
        await ns.sleep(100);
        if (ns.getRunningScript(pid) === null) {
            break;
        }
    }
}
