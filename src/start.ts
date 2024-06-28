import type { NS } from "netscript";

export async function main(ns: NS) {
    await waitForExit(ns, ns.run("/get-all-hosts.js"));
    // Sleep to let the game fully write out the all-hosts.js script
    await ns.sleep(1000);
    ns.tprint("finished fetching all host info");

    await waitForExit(ns, ns.run("/crack-all.js"));
    ns.tprint("finished cracking all possible hosts");

    // let homeMaxRAM = ns.getServerMaxRam('home');
}

async function waitForExit(ns: NS, pid: number): Promise<void> {
    while (true) {
        await ns.sleep(100);
        if (ns.getRunningScript(pid) === null) {
            break;
        }
    }
}
