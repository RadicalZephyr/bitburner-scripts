import type { NS, AutocompleteData } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { LaunchClient } from 'services/client/launch';
import { makeFuid } from 'util/fuid';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

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

    await grindThatLevel(ns);
}

async function grindThatLevel(ns: NS) {
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
async function buyProgramGrindLoop(ns: NS, programName: string) {
    let running = true;
    ns.atExit(() => {
        running = false;
    }, makeFuid(ns));
    while (running) {
        ns.rm(programName);
        ns.singularity.purchaseProgram(programName);
        await ns.asleep(10);
    }
}

/**
 * Grind intelligence by creating a program and removing it repeatedly.
 */
async function writePrograms(ns: NS) {
    const program = 'ServerProfiler.exe';

    let running = true;
    ns.atExit(() => {
        running = false;
    }, makeFuid(ns));
    while (running) {
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
