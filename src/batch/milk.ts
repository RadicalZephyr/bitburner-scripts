import type { NS, AutocompleteData } from "netscript";

import {
    Heap,
    calculateMilkRound,
    getAllHosts,
    inverseAvailableRam,
    numThreads,
    spawnBatchScript,
    usableHosts,
    withLimitedThreads
} from '../lib';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const options = ns.flags([
        ['hack_percent', 0.9],
        ['help', false]
    ]);

    if (options.help || options._.length < 1) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} TARGET_HOST

Calculate and start an entire milking round against the TARGET HOST.

OPTIONS
  --help          Show this help message
  --hack_percent  Scale the number of threads for each script
`);
        return;
    }

    const hack_percent = Math.max(0.01, Math.min(options.hack_percent, 0.99));
    const target = options._[0];
    if (typeof target != 'string' || !ns.serverExists(target)) {
        ns.tprintf('invalid target');
        return;
    }

    let batchNumber = 0;
    while (true) {
        const allHosts = getAllHosts(ns);
        let hosts = usableHosts(ns, allHosts);
        let hostsWithThreads = augmentWithAvailableThreads(ns, hosts);

        let hostsHeap = new Heap(hostsWithThreads, hwt => 1 / hwt.threads);

        let milkRound = calculateMilkRound(ns, target, hack_percent);

        for (let instance of milkRound.instances) {
            let host = hostsHeap.min();

            // Check if enough RAM is available
            while (host && host.threads <= instance.threads) {
                const limitedThreadsInstance = withLimitedThreads(instance, host.threads);

                spawnBatchScript(ns, host.name, limitedThreadsInstance, batchNumber);

                // Deduct spawned threads from our target total
                instance.threads -= limitedThreadsInstance.threads;

                // Remove this host from the heap because we just
                // used all the remaining threads.
                hostsHeap.pop();

                // Choose the newest min host
                host = hostsHeap.min();
            }

            // If the hosts heap is empty, then we should quit
            if (!host) return;

            // If there are still threads remaining in the instance
            if (instance.threads > 0) {
                // launch one final instance on the current host
                spawnBatchScript(ns, host.name, instance, batchNumber);

                // and deduct those threads from the host thread count
                host.threads -= instance.threads;
                // and re-heapify the hosts list
                hostsHeap.updateMinKey();
            }
        }

        batchNumber += 1;

        await ns.sleep(milkRound.batchOffset);
    }
}

type HostWithThread = {
    name: string;
    threads: number;
};

function augmentWithAvailableThreads(ns: NS, hosts: string[]): HostWithThread[] {
    return hosts.map((host) => { return { name: host, threads: numThreads(ns, host, '/batch/grow.js') } });
}
