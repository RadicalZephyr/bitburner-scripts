import type {
    NS,
    UniversityClassType,
    UniversityLocationName,
} from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import {
    Aug,
    augCost,
    buyReputation,
    getBestFaction,
} from 'automation/buy-augments';
import { trainCombat } from 'automation/gym';
import { buyPortOpeners } from 'automation/port-openers';
import { travelTo } from 'automation/travel';
import { CONFIG } from 'automation/config';

import { MoneyTracker, primedMoneyTracker } from 'util/money-tracker';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help || (flags._ as string[]).length !== 0) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Automate late bitnode progression and reinstall augmentations.

OPTIONS
  --help   Show this help message

CONFIGURATION
  AUTO_moneyTrackerHistoryLen   Samples to average hack income
  AUTO_moneyTrackerCadence      Delay between income samples
  AUTO_maxTimeToEarnNeuroFlux   Max time to afford next NeuroFlux level
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
