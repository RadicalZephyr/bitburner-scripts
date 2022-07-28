import type { NS, AutocompleteData } from "netscript";

import {
    byAvailableRam,
    byTotalThreads,
    calculateMilkRound,
    milkableHosts,
    numThreads,
    spawnBatchScript,
    usableHosts,
    walkNetworkBFS
} from '../lib';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const network = walkNetworkBFS(ns);
    const allHosts = Array.from(network.keys());

    let targetRounds = milkableHosts(ns, allHosts).map(t => calculateMilkRound(ns, t));
    targetRounds.sort(byTotalThreads(ns));

    for (const milkRound of targetRounds) {

        const scriptDescriptions = milkRound.instances.map(si => `  ${si.script} -t ${si.threads}`).join('\n');
        ns.tprint(`
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
        }
    }
}
