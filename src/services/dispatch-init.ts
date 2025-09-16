import type { NS, AutocompleteData, RunOptions } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { MemoryClient } from 'services/client/memory';
import { ALLOC_ID_ARG } from 'services/client/memory_tag';

import { collectDependencies } from 'util/dependencies';
import { exitOnKill } from 'util/exitOnKill';

import { CONFIG } from 'services/config';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

const executorOptions: RunOptions = {
    threads: 1,
    preventDuplicates: true,
    temporary: true,
};

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Launch the dispatch executor.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await launchDispatchExecutor(ns);

    return exitOnKill(ns);
}

async function launchDispatchExecutor(ns: NS) {
    const memClient = new MemoryClient(ns);

    const selfScript = ns.self();
    const selfRam = selfScript.ramUsage;
    const alloc = await memClient.requestTransferableAllocation(
        selfRam + CONFIG.maxNsFnRam,
        1,
        { longRunning: true },
    );

    if (
        !alloc
        || alloc.allocatedChunks.length < 1
        || alloc.allocatedChunks[0].numChunks < 1
    )
        throw new Error('Failed to allocate memory for dispatch executor.');

    alloc.releaseAtExit(ns);

    const hostname = alloc.allocatedChunks[0].hostname;

    const script = '/services/dispatch.js';
    const dependencies = collectDependencies(ns, script);
    const files = [script, ...dependencies];

    if (!ns.scp(files, hostname, 'home'))
        throw new Error('Failed to scp files for executor');

    const pid = ns.exec(
        script,
        hostname,
        executorOptions,
        ALLOC_ID_ARG,
        alloc.allocationId,
    );

    if (pid === 0)
        throw new Error(`Failed to start executor script on ${hostname}`);
}
