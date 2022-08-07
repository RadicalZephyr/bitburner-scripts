import type { NS, AutocompleteData } from "netscript";

import {
    byAvailableRam,
    calculateMilkRound,
    getAllHosts,
    numThreads,
    spawnBatchScript,
    usableHosts
} from '../lib';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const target = ns.args[0];
    if (typeof target != 'string' || !ns.serverExists(target)) {
        ns.tprintf('invalid target');
        return;
    }

    const allHosts = getAllHosts(ns);

    const milkRound = calculateMilkRound(ns, target);

    const scriptDescriptions = milkRound.instances.map(si => `  ${si.script} -t ${si.threads}`).join('\n');
    ns.print(`
milking ${milkRound.target}:
${scriptDescriptions}
total batch time: ${milkRound.totalBatchTime}
number of batches: ${milkRound.numberOfBatches}
total number of threads needed: ${milkRound.totalThreads}
`);

    let hosts = usableHosts(ns, allHosts);
    hosts.sort(byAvailableRam(ns));

    let batchNumber = 0;

    for (const host of hosts) {
        let availableHostThreads = numThreads(ns, host, '/batch/grow.js');

        while (batchNumber < milkRound.numberOfBatches && availableHostThreads > milkRound.totalBatchThreads) {
            milkRound.instances.forEach(inst => spawnBatchScript(ns, host, inst, batchNumber));
            batchNumber += 1;
            await ns.sleep(milkRound.batchOffset);
            availableHostThreads = numThreads(ns, host, '/batch/grow.js');
        }
        await ns.sleep(100);
    }
}
