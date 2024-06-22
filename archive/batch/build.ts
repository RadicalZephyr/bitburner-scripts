import type { NS, AutocompleteData } from "netscript";

import {
    BatchScriptInstance,
    availableHosts,
    availableRam,
    calculateBuildRound,
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

    const buildRound = calculateBuildRound(ns, target);

    // const scriptDescriptions = buildRound.instances.map(si => `  ${si.script} -t ${si.threads}`).join('\n');
    //     ns.tprint(`
    // building ${target}:
    // ${scriptDescriptions}
    // `);

    if (buildRound.totalThreads < 1) {
        ns.tprint(`${target} does not need to be built`);
        return;
    }

    let batchNumber = 0;

    while (batchNumber < buildRound.numberOfBatches) {
        const allHosts = getAllHosts(ns);
        const hosts = availableHosts(ns, usableHosts(ns, allHosts));
        const host = maxRamHost(ns, hosts);

        if (host === undefined) return;

        const availableHostThreads = numThreads(ns, host, '/batch/grow.js');

        // Check if enough RAM is available
        if (availableHostThreads < buildRound.totalBatchThreads) {
            // Since the heap is sorted by max memory, if the max
            // memory host in the heap doesn't have enough memory,
            // then none of the others do either, so we should just stop.
            break;
        }

        const maxBatches = Math.floor(availableHostThreads / buildRound.totalBatchThreads);

        const totalBatches = Math.min(maxBatches, buildRound.numberOfBatches - batchNumber);

        buildRound.instances.forEach(inst => spawnBatchScript(ns, host, scaleBatchThreads(inst, totalBatches), batchNumber));
        batchNumber += totalBatches;

        await ns.sleep(500);
    }
}

function maxRamHost(ns: NS, hosts: string[]): string {
    let maxRam = 0;
    let maxRamHost;

    for (const host of hosts) {
        const hostRam = availableRam(ns, host);
        if (hostRam > maxRam) {
            maxRam = hostRam;
            maxRamHost = host;
        }
    }

    return maxRamHost;
}

function scaleBatchThreads(inst: BatchScriptInstance, scale: number): BatchScriptInstance {
    const {
        target,
        script,
        threads,
        startTime,
        runTime,
        endDelay,
        loop
    } = inst;
    return {
        target,
        script,
        threads: Math.floor(scale * threads),
        startTime,
        runTime,
        endDelay,
        loop
    };
}
