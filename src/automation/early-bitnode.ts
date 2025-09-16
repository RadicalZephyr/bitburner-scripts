import type { AutocompleteData, GymType, NS } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

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
    await untilHackLevel(ns, 10);

    try {
        startSleevesWorkingOut(ns);
    } catch (err) {
        ns.print(`WARN: failed to start sleeves working out: ${String(err)}`);
    }

    if (!ns.singularity.gymWorkout('Powerhouse Gym', 'agi'))
        throw new Error('failed to workout agility at Powerhouse Gym');

    await untilCombatStat(ns, 'agi', 10);

    try {
        startSleevesShoplifting(ns);
    } catch (err) {
        ns.print(`WARN: failed to start sleeves shoplifting: ${String(err)}`);
    }

    if (!ns.singularity.commitCrime('Shoplift'))
        throw new Error('Failed to start shoplifting!');
}

function startSleevesShoplifting(ns: NS) {
    const numSleeves = ns.sleeve.getNumSleeves();
    for (let i = 0; i < numSleeves; i++) {
        if (!ns.sleeve.setToCommitCrime(i, 'Shoplift'))
            throw new Error(`Failed to start sleeve ${i} shoplifting.`);
    }
}

async function untilCombatStat(
    ns: NS,
    stat: GymType | `${GymType}`,
    targetLevel: number,
) {
    while (true) {
        const statLevel = ns.getPlayer().skills[stat];
        if (statLevel >= targetLevel) return;
        await ns.asleep(1000);
    }
}

function startSleevesWorkingOut(ns: NS) {
    const numSleeves = ns.sleeve.getNumSleeves();
    for (let i = 0; i < numSleeves; i++) {
        if (i % 2 === 0) {
            if (!ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', 'agi'))
                throw new Error('failed to workout agility at Powerhouse Gym');
        } else {
            if (!ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', 'dex'))
                throw new Error(
                    'failed to workout dexterity at Powerhouse Gym',
                );
        }
    }
}

async function untilHackLevel(ns: NS, targetLevel: number) {
    while (true) {
        const hackLevel = ns.getHackingLevel();
        if (hackLevel >= targetLevel) return;
        await ns.asleep(1000);
    }
}

async function sowAndHackNoodles(ns: NS) {
    // Start minimal services
    const pid = ns.run('/start.js', 1, '--minimal');

    if (pid === 0) throw new Error('failed to run start script');

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
    if (!sowResult) throw new Error('failed to launch sow against n00dles');

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
