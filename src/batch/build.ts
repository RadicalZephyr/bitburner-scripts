import type { NS, AutocompleteData } from "netscript";

import {
    byAvailableRam,
    calculateBuildRound,
    numThreads,
    spawnBatchScript,
    usableHosts,
} from '../lib.js';
import { walkNetworkBFS } from "../walk-network.js";

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const target = ns.args[0];
    if (typeof target != 'string' || !ns.serverExists(target)) {
        ns.tprintf('invalid target');
        return;
    }

    const buildRound = calculateBuildRound(ns, target);

    const scriptDescriptions = buildRound.instances.map(si => `  ${si.script} -t ${si.threads}`).join('\n');
    ns.tprint(`
building ${target}:
${scriptDescriptions}
`);

    if (buildRound.totalThreads < 1) {
        ns.tprint(`${target} does not need to be built`);
        return;
    }

    const network = walkNetworkBFS(ns);
    const allHosts = Array.from(network.keys());

    let hosts = usableHosts(ns, allHosts);
    hosts.sort(byAvailableRam(ns));

    let batchNumber = 0;

    for (const host of hosts) {
        let availableHostThreads = numThreads(ns, host, '/batch/grow.js');

        while (batchNumber < buildRound.numberOfBatches && availableHostThreads > buildRound.totalBatchThreads) {
            buildRound.instances.forEach(inst => spawnBatchScript(ns, host, inst, batchNumber));
            batchNumber += 1;
            await ns.sleep(10);
            availableHostThreads = numThreads(ns, host, '/batch/grow.js');
        }
    }
}
