import type {
    CityName,
    GymLocationName,
    GymType,
    NS,
    UniversityClassType,
    UniversityLocationName,
} from 'netscript';

import {
    Aug,
    augCost,
    buyReputation,
    getBestFaction,
} from 'automation/buy-augments';
import { CONFIG } from 'automation/config';

import { MoneyTracker, primedMoneyTracker } from 'util/money-tracker';
import { FlagsSchema } from 'util/flags';

const FLAGS = [['help', false]] satisfies FlagsSchema;

export async function main(ns: NS) {
    const flags = ns.flags(FLAGS);
    if (typeof flags.help !== 'boolean' || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Automate an end-to-end install loop to prep hacking, buy augments and reinstall.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message

CONFIGURATION
  AUTO_moneyTrackerHistoryLen  Number of samples for money velocity
  AUTO_moneyTrackerCadence     Interval between money samples
  AUTO_maxTimeToEarnNeuroFlux  Max time allowed to earn next NFG
`);
        return;
    }

    const Volhaven = ns.enums.CityName.Volhaven;
    const zbU = ns.enums.LocationName.VolhavenZBInstituteOfTechnology;
    const algClass = ns.enums.UniversityClassType.algorithms;

    ns.ui.openTail();

    ns.run('automation/join-factions.js');

    purchaseTor(ns);

    travelTo(ns, Volhaven);
    study(ns, zbU, algClass);

    await untilHackLevel(ns, 1000);

    ns.run('start.js');
    await ns.sleep(10_000);

    ns.run('batch/harvest.js', 1, 'n00dles');
    await ns.sleep(10_000);
    ns.run('automation/hack.js');

    await trainCombat(ns, 1200);

    await buyPortOpeners(ns);

    travelTo(ns, Volhaven);
    study(ns, zbU, algClass);

    // Sleep for ten minutes to let the hacking get up to speed
    await ns.sleep(10 * 60 * 1000);
    await buyNeuroFlux(ns);

    // The final step, this eventually restarts this script after a
    // fresh install.
    ns.singularity.installAugmentations('automation/loop-install.js');
}

function purchaseTor(ns: NS) {
    if (ns.getServerMoneyAvailable('home') < 200_000)
        throw new Error('not enough money to purchase TOR');
    if (!ns.hasTorRouter() && !ns.singularity.purchaseTor())
        throw new Error('could not purchase TOR');
}

function travelTo(ns: NS, city: CityName) {
    if (ns.getServerMoneyAvailable('home') < 200_000)
        throw new Error(`not enough money to travel to ${city}`);
    if (!ns.singularity.travelToCity(city))
        throw new Error(`failed to travel to ${city}`);
}

function study(
    ns: NS,
    uni: UniversityLocationName | `${UniversityLocationName}`,
    course: UniversityClassType,
) {
    if (!ns.singularity.universityCourse(uni, course, false))
        throw new Error(`could not study ${course} at ${uni}`);
}

async function untilHackLevel(ns: NS, targetLevel: number) {
    while (true) {
        const hackLevel = ns.getHackingLevel();
        if (hackLevel >= targetLevel) return;
        await ns.sleep(1000);
    }
}

async function trainCombat(ns: NS, targetLevel: number) {
    const powerhouseGym = ns.enums.LocationName.Sector12PowerhouseGym;
    const GymType = ns.enums.GymType;

    travelTo(ns, ns.enums.CityName.Sector12);

    const combatSkills = new Set([
        'strength',
        'defense',
        'dexterity',
        'agility',
    ]);
    while (true) {
        const playerSkills = ns.getPlayer().skills;
        const skillsToTrain = Object.keys(playerSkills)
            .filter((s) => combatSkills.has(s))
            .map((s) => {
                return { name: s, level: playerSkills[s] };
            })
            .filter((s) => s.level < targetLevel);

        if (skillsToTrain.length === 0) return;

        skillsToTrain.sort((a, b) => a.level - b.level);

        const skill = skillsToTrain[0];
        gymWorkout(ns, powerhouseGym, GymType[skill.name]);

        await ns.sleep(10_000);
    }
}

function gymWorkout(
    ns: NS,
    location: GymLocationName | `${GymLocationName}`,
    stat: GymType,
) {
    if (!ns.singularity.gymWorkout(location, stat, false))
        throw new Error(`failed to workout ${stat} at ${location}`);
}

const PROGRAMS = [
    'BruteSSH.exe',
    'FTPCrack.exe',
    'relaySMTP.exe',
    'HTTPWorm.exe',
    'SQLInject.exe',
];

async function buyPortOpeners(ns: NS) {
    for (const prog of PROGRAMS) {
        if (ns.fileExists(prog, 'home')) continue;
        const cost = ns.singularity.getDarkwebProgramCost(prog);
        await moneyAtLeast(ns, cost);
        if (!ns.singularity.purchaseProgram(prog))
            throw new Error(`failed to purchase ${prog} from the darkweb`);
    }
}

async function moneyAtLeast(ns: NS, targetMoney: number) {
    while (getPlayerMoney(ns) < targetMoney) {
        await ns.asleep(10_000);
    }
}

function getPlayerMoney(ns: NS): number {
    return ns.getServerMoneyAvailable('home');
}

async function buyNeuroFlux(ns: NS) {
    const sing = ns.singularity;

    const nfgName = 'NeuroFlux Governor';

    let bestFaction = getBestFaction(ns);
    while (!bestFaction) {
        await ns.asleep(10_000);
        bestFaction = getBestFaction(ns);
    }

    let cost = augCost(ns, nfgName);

    const moneyTracker = await primedMoneyTracker(
        ns,
        CONFIG.moneyTrackerHistoryLen,
        CONFIG.moneyTrackerCadence,
    );

    while (canBuyWithinMaxTime(ns, moneyTracker, cost)) {
        const factionRep = ns.singularity.getFactionRep(bestFaction);
        const neuro = new Aug(ns, nfgName, bestFaction);

        if (factionRep < neuro.rep) buyReputation(ns, neuro);

        // Wait to give the game time to update reputation and our
        // cash before trying to purchase augmentations.
        await ns.asleep(1000);

        if (canAfford(ns, cost)) {
            const res = sing.purchaseAugmentation(neuro.faction, neuro.name);
            if (!res) {
                ns.print(`finished buying NeuroFlux Governor`);
                return;
            }
            cost = augCost(ns, neuro.name);
        }

        await ns.asleep(10_000);
    }
}

function canAfford(ns: NS, cost: number): boolean {
    return ns.getServerMoneyAvailable('home') >= cost;
}

function canBuyWithinMaxTime(
    ns: NS,
    moneyTracker: MoneyTracker,
    cost: number,
): boolean {
    const myMoney = ns.getServerMoneyAvailable('home');
    const moneyToEarn = cost - myMoney;

    if (Number.isFinite(moneyToEarn) && moneyToEarn <= 0) return true;

    const hackMoneyVelocity = moneyTracker.velocity('hacking');
    // TODO: this is a bit suspect, if we stop hacking then this
    // velocity remains zero and we keep looping forever.
    if (hackMoneyVelocity === 0) return true;

    ns.print(`money for next NFG level: $${ns.formatNumber(moneyToEarn)}`);
    ns.print(`current earn rate: $${ns.formatNumber(hackMoneyVelocity)}/s `);
    const timeToEarn = moneyToEarn / hackMoneyVelocity;
    ns.print(
        `time to earn next NeuroFlux Governor level: ${ns.tFormat(timeToEarn * 1000)}`,
    );
    return timeToEarn <= CONFIG.maxTimeToEarnNeuroFlux;
}
