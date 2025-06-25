import type { NS } from "netscript";

import { registerAllocationOwnership } from "./client/memory";

export async function main(ns: NS) {
    ns.disableLog('ALL');

    const flags = ns.flags([
        ['allocation-id', -1],
        ['help', false],
    ]);

    const rest = flags._ as string[];
    if (rest.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SERVER_NAME

Launch as many grow and weaken threads as needed to maximize money
of SERVER_NAME while keeping security at a minimum.

Example:
> run ${ns.getScriptName()} n00dles

OPTIONS
--help           Show this help message
`);
        return;
    }

    let allocationId = flags['allocation-id'];
    if (allocationId !== -1) {
        if (typeof allocationId !== 'number') {
            ns.tprint('--allocation-id must be a number');
            return;
        }
        registerAllocationOwnership(ns, allocationId, "self");
    }

    let target = rest[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf("target %s does not exist", target);
        return;
    }

    // TODO: Calculate the relative start times for each of the four
    // scripts in a batch.

    // Important APIs for this:

    let batchInterval = CONFIG.batchInterval;

    let hScript = "/batch/h.js";
    let hTime = ns.getHackTime(target);

    let gScript = "/batch/g.js";
    let gTime = ns.getGrowTime(target);

    let wScript = "/batch/w.js";
    let wTime = ns.getWeakenTime(target);

    // Each batch consists of 4 scripts that should finish in this
    // sequence: hack, weaken, grow, weaken. Each script in the
    // sequence should finish running one `batchInterval` after the
    // previous script. The first argument to each of the hScript,
    // gScript and wScript scripts is an amount of time to sleep
    // before running it's operation. Using the respective running
    // times hTime, gTime, and wTime, calculate how long each script
    // needs to sleep before starting so that they end in the correct
    // order with the correct interval between them.
}
