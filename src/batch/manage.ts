import type { NS } from "netscript";

import { WORKERS_PORT, WORKERS_DONE } from "util/ports";

const tillScript = "/batch/till.js";
const sowScript = "/batch/sow.js";
const harvestScript = "/batch/harvest.js";

export async function main(ns: NS) {
    let workersPort = ns.getPortHandle(WORKERS_PORT);

    let workers = [];

    let tillers = [];
    let sowers = [];
    let harvesters = [];

    let i = 0;
    while (true) {
        await workersPort.nextWrite();
        let nextWorker = workersPort.read() as string;
        // Check for the done sentinel value
        if (nextWorker === WORKERS_DONE) {
            break;
        }

        workers.push(nextWorker);
        switch (i % 3) {
            case 0:
                tillers.push(startTiller(ns, nextWorker));
                break;
            case 1:
                sowers.push(startSower(ns, nextWorker));
                break;
            case 2:
                harvesters.push(startHarvester(ns, nextWorker));
                break;
        }
        i += 1;
    }
}

function startTiller(ns: NS, worker: string): number {
    return ns.exec(tillScript, worker);
}

function startSower(ns: NS, worker: string): number {
    return ns.exec(sowScript, worker);
}

function startHarvester(ns: NS, worker: string): number {
    return ns.exec(harvestScript, worker);
}
