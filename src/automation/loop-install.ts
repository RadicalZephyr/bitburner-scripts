import type { NS, UniversityClassType, UniversityLocationName } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import {
    Aug,
    augCost,
    buyReputation,
    getBestFactionForNFG,
    neededReputationCost,
} from 'automation/buy-augments';
import { trainCombat } from 'automation/workout';
import { buyPortOpeners } from 'automation/purchase-crackers';
import { travelTo } from 'automation/travel';
import { CONFIG } from 'automation/config';

import { canAfford } from 'util/money';
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
    const powerhouseGym = ns.enums.LocationName.Sector12PowerhouseGym;
    const algClass = ns.enums.UniversityClassType.algorithms;

    ns.ui.openTail();

    ns.run('automation/join-factions.js');

    travelTo(ns, Volhaven);
    study(ns, zbU, algClass);

    await untilHackLevel(ns, 1000);

    ns.run('start.js');
    await ns.sleep(10_000);

    ns.run('sleeve/study.js', 1, '--course', 'Algorithms');

    await trainCombat(ns, powerhouseGym, 1200);

    await buyPortOpeners(ns);

    travelTo(ns, Volhaven);
    study(ns, zbU, algClass);

    void grindIntelligence(ns).catch((e) =>
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        ns.print(`ERROR: Grind intelligence failed: ${String(e)}`),
    );

    const bestFaction = await eventuallyGetBestFactionForNGF(ns);

    // Wait until we can buy at least one NFG level
    await buyOneNeuroFlux(ns, bestFaction);

    // Buy as many NFG levels as we can within a reasonable time
    await buyNeuroFlux(ns, bestFaction);

    // The final step, this eventually restarts this script after a
    // fresh install.
    ns.singularity.installAugmentations('automation/loop-install.js');
}

async function grindIntelligence(ns: NS) {
    const fulcrumHackLevel = ns.getServerRequiredHackingLevel('fulcrumassets');
    await untilHackLevel(ns, 10 * fulcrumHackLevel);
    ns.run('grind/intelligence.js');
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

async function eventuallyGetBestFactionForNGF(ns: NS): Promise<string> {
    let bestFaction = getBestFactionForNFG(ns);
    while (!bestFaction) {
        await ns.asleep(10_000);
        bestFaction = getBestFactionForNFG(ns);
    }
    return bestFaction;
}

async function buyOneNeuroFlux(ns: NS, bestFaction: string) {
    const nfgName = 'NeuroFlux Governor';

    const neuro = new Aug(ns, nfgName, bestFaction);
    const donation = neededReputationCost(ns, neuro);

    // TODO: Check for donation > 0
    if (!Number.isFinite(donation))
        throw new Error(
            `Cannot donate to buy Neuroflux Governor, you need more faction rep!`,
        );
    while (!canAfford(ns, donation)) await ns.asleep(1000);

    if (donation > 0) {
        const donated = ns.singularity.donateToFaction(neuro.faction, donation);
        if (!donated)
            throw new Error(
                `Could not donate to ${neuro.faction} for reputation!`,
            );
    }

    const cost = augCost(ns, nfgName);
    while (!canAfford(ns, cost)) await ns.asleep(1000);

    const purchased = ns.singularity.purchaseAugmentation(
        neuro.faction,
        neuro.name,
    );
    if (!purchased) throw new Error('Could not buy Neuroflux Governor!');
}

async function buyNeuroFlux(ns: NS, bestFaction: string) {
    const sing = ns.singularity;

    const nfgName = 'NeuroFlux Governor';

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
