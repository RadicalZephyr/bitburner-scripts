import type { NS, AutocompleteData } from "netscript";

import {
    Heap,
    calculateMilkRound,
    getAllHosts,
    inverseAvailableRam,
    numThreads,
    spawnBatchScript,
    usableHosts
} from '../lib';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const options = ns.flags([
        ['scale', 1],
        ['help', false]
    ]);

    if (options.help || options._.length < 1) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} TARGET_HOST

Calculate and start an entire milking round against the TARGET HOST.

OPTIONS
  --help   Show this help message
  --scale  Scale the number of threads for each script
`);
        return;
    }

    const scale = Math.max(Math.round(options.scale), 1);
    const target = options._[0];
    if (typeof target != 'string' || !ns.serverExists(target)) {
        ns.tprintf('invalid target');
        return;
    }

    const allHosts = getAllHosts(ns);

    const milkRound = calculateMilkRound(ns, target);
    milkRound.instances.forEach(inst => inst.threads * scale);

    const scriptDescriptions = milkRound.instances.map(si => `  ${si.script} -t ${si.threads}`).join('\n');
    ns.print(`
milking ${milkRound.target}:
${scriptDescriptions}
total batch time: ${milkRound.totalBatchTime}
number of batches: ${milkRound.numberOfBatches}
total number of threads needed: ${milkRound.totalThreads}
`);

    let hosts = usableHosts(ns, allHosts);

    let hostsHeap = new Heap(hosts, host => inverseAvailableRam(ns, host));

    let batchNumber = 0;

    while (batchNumber < milkRound.numberOfBatches) {
        const host = hostsHeap.min();
        const availableHostThreads = numThreads(ns, host, '/batch/grow.js');

        // Check if enough RAM is available
        if (availableHostThreads < milkRound.totalBatchThreads) {
            // Since the heap is sorted by max memory, if the max
            // memory host in the heap doesn't have enough memory,
            // then none of the others do either, so we should just stop.
            break;
        }

        milkRound.instances.forEach(inst => spawnBatchScript(ns, host, inst, batchNumber));
        batchNumber += 1;

        await ns.sleep(milkRound.batchOffset);
        hostsHeap.updateMinKey();
    }
}
