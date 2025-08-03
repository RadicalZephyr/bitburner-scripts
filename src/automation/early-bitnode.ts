import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { CONFIG } from 'automation/config';

import { LaunchClient } from 'services/client/launch';

import { waitForExit } from 'util/wait';

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

Startup automation suitable for use early in a new bitnode (i.e. low RAM and money).

Starts minimal services and begins sowing and hacking n00dles.

OPTIONS
  --help   Show this help message
`);
        return;
    }

    // Launch sowing and harvesting n00dles as a background task
    sowAndHackNoodles(ns);
    await studyAndCode(ns);
}

async function studyAndCode(ns: NS) {
    // Study algorithms at Rothman U
    const rothmanU = ns.enums.LocationName.Sector12RothmanUniversity;
    const algCourse = ns.enums.UniversityClassType.algorithms;
    if (!ns.singularity.universityCourse(rothmanU, algCourse))
        throw new Error('failed to study algorithms at Rothman University');

    // Wait until we can create BruteSSH.exe
    await untilHackLevel(ns, CONFIG.bruteSshHackRequirement);

    // Create BruteSSH.exe
    if (!ns.singularity.createProgram('BruteSSH.exe', true))
        throw new Error('failed to start working on BruteSSH.exe');

    let work = ns.singularity.getCurrentWork();
    while (work && work.type === 'CREATE_PROGRAM') {
        await ns.sleep(10_000);
        work = ns.singularity.getCurrentWork();
    }

    // Wait until we can create FTPCrack.exe
    await untilHackLevel(ns, CONFIG.ftpCrackHackRequirement);

    // Create FTPCrack.exe
    if (!ns.singularity.createProgram('FTPCrack.exe', true))
        throw new Error('failed to start working on BruteSSH.exe');
}

async function untilHackLevel(ns: NS, targetLevel: number) {
    while (true) {
        const hackLevel = ns.getHackingLevel();
        if (hackLevel >= targetLevel) return;
        await ns.sleep(1000);
    }
}

async function sowAndHackNoodles(ns: NS) {
    // Start minimal services
    ns.run('/start.js', 1, '--minimal');

    const client = new LaunchClient(ns);
    const noods = 'n00dles';

    const sowResult = await client.launch(
        '/batch/sow.js',
        {
            threads: 1,
            alloc: { longRunning: true },
        },
        noods,
    );
    if (!sowResult) throw new Error('failed to launch harvest against n00dles');

    await waitForExit(ns, sowResult.pids[0]);

    const harvestResult = await client.launch(
        '/batch/harvest.js',
        {
            threads: 1,
            alloc: { longRunning: true },
        },
        noods,
        '--port-id',
        111111,
    );
    if (!harvestResult)
        throw new Error('failed to launch harvest against n00dles');
}
