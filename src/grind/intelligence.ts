import type { NS, AutocompleteData } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { withPlugins } from 'ns/extend';
import { alivePlugin } from 'ns/plugins/alive';

import { LaunchClient } from 'services/client/launch';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

function extendNs(ns: NS) {
    return withPlugins(ns, alivePlugin());
}

type NSX = ReturnType<typeof extendNs>;

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Grind intelligence level as fast as machinely possible!

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await grindThatLevel(extendNs(ns));
}

async function grindThatLevel(ns: NSX) {
    const target = 'fulcrumassets';

    const launch = new LaunchClient(ns);

    const launchOptions = { threads: 1, alloc: { longRunning: true } };
    const harvest = launch.launch('batch/harvest.js', launchOptions, target);
    const automation = launch.launch(
        'automation/hack.js',
        launchOptions,
        target,
    );
    const manual = launch.launch('manual/hack.js', launchOptions, target);

    const travel = launch.launch('grind/travel.js', launchOptions);

    await Promise.all([harvest, automation, manual, travel]);

    const programs = [
        'BruteSSH.exe',
        'FTPCrack.exe',
        'relaySMTP.exe',
        'HTTPWorm.exe',
        'SQLInject.exe',
        'DeepscanV1.exe',
        'DeepscanV2.exe',
        'AutoLink.exe',
    ];
    for (const program of programs) {
        void buyProgramGrindLoop(ns, program);
    }

    await writePrograms(ns);
}

/**
 * Grind intelligence by buying and removing a program repeatedly.
 */
async function buyProgramGrindLoop(ns: NSX, programName: string) {
    while (ns.alive.isAlive()) {
        ns.rm(programName);
        ns.singularity.purchaseProgram(programName);
        await ns.asleep(10);
    }
}

/**
 * Grind intelligence by creating a program and removing it repeatedly.
 */
async function writePrograms(ns: NSX) {
    const program = 'ServerProfiler.exe';

    while (ns.alive.isAlive()) {
        ns.rm(program);
        ns.singularity.createProgram(program, false);
        await doneWorking(ns);
    }
}

async function doneWorking(ns: NS) {
    while (ns.singularity.isBusy()) {
        await ns.asleep(10);
    }
}
