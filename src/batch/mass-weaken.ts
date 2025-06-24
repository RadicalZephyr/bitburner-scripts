import type { AutocompleteData, NS } from "netscript";

import { launch } from "/batch/launch";

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    ns.disableLog('ALL');

    const flags = ns.flags([
        ['help', false],
    ]);

    const rest = flags._ as string[];
    if (rest.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SERVER_NAME

Launch as many weaken threads as needed to minimize security of SERVER_NAME.

Example:
  > run ${ns.getScriptName()} n00dles

OPTIONS
  --help           Show this help message
`);
        return;
    }

    let target = rest[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf("target %s does not exist", target);
        return;
    }

    ns.ui.setTailTitle(`weaken ${target}`);

    let expectedTime = ns.tFormat(ns.getWeakenTime(target));

    let threads = calculateWeakenThreads(ns, target);

    if (threads == 0) {
        ns.tprintf("%s security is already at minimum level", target);
    }

    let result = await launch(ns, "/batch/w.js", threads, target, 0, 1, 0);

    result.allocation.releaseAtExit(ns);

    for (const pid of result.pids) {
        while (ns.isRunning(pid)) {
            ns.clearLog();
            let selfScript = ns.self();
            ns.print(`
Expected time: ${expectedTime}
Elapsed time: ${ns.tFormat(selfScript.onlineRunningTime * 1000)}
`);
            await ns.sleep(1000);
        }
    }
    ns.toast(`finished weakening ${target}!`, "success");
}

function calculateWeakenThreads(ns: NS, target: string): number {
    let minSec = ns.getServerMinSecurityLevel(target);
    let curSec = ns.getServerSecurityLevel(target);
    let deltaSec = curSec - minSec;

    if (deltaSec <= 0) return 0;

    return Math.ceil(deltaSec * 20);
}
