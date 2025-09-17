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

    await Promise.all([harvest, automation, manual]);

    await writePrograms(ns);
}

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
