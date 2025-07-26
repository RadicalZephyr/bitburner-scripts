import type {
    CityName,
    GymLocationName,
    GymType,
    MoneySource,
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

import { StatTracker } from 'util/stat-tracker';

export async function main(ns: NS) {
    const Volhaven = ns.enums.CityName.Volhaven;
    const zbU = ns.enums.LocationName.VolhavenZBInstituteOfTechnology;
    const algClass = ns.enums.UniversityClassType.algorithms;

    ns.run('automation/join-factions.js');

    purchaseTor(ns);

    travelTo(ns, Volhaven);
    study(ns, zbU, algClass);

    await untilHackLevel(ns, 1000);

    ns.run('start.js');
    await ns.sleep(10_000);

    ns.run('automation/hack.js');

    await trainCombat(ns, 1200);

    travelTo(ns, Volhaven);
    study(ns, zbU, algClass);

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

async function buyNeuroFlux(ns: NS) {
    const sing = ns.singularity;

    const nfgName = 'NeuroFlux Governor';

    let bestFaction = getBestFaction(ns);
    while (!bestFaction) {
        await ns.asleep(10_000);
        bestFaction = getBestFaction(ns);
    }

    let cost = augCost(ns, nfgName);

    const moneyTracker = await primedMoneyTracker(ns);

    while (canBuyWithinMaxTime(ns, moneyTracker, cost)) {
        const factionRep = ns.singularity.getFactionRep(bestFaction);
        const neuro = new Aug(ns, nfgName, bestFaction);

        if (factionRep < neuro.rep) buyReputation(ns, neuro);

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
    moneyTracker: StatTracker<MoneySource>,
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

async function primedMoneyTracker(ns: NS): Promise<StatTracker<MoneySource>> {
    const moneyTracker = new StatTracker<MoneySource>(
        CONFIG.moneyTrackerHistoryLen,
    );

    for (let i = 0; i < CONFIG.moneyTrackerHistoryLen; i++) {
        await updateMoneyTracker(ns, moneyTracker);
    }
    tickUpdates(ns, moneyTracker);

    return moneyTracker;
}

async function tickUpdates(ns: NS, moneyTracker: StatTracker<MoneySource>) {
    let running = true;
    ns.atExit(() => {
        running = false;
    }, 'loopInstall-tickMoneyTrackerUpdates');

    while (running) {
        await updateMoneyTracker(ns, moneyTracker);
    }
}

async function updateMoneyTracker(
    ns: NS,
    moneyTracker: StatTracker<MoneySource>,
) {
    moneyTracker.update(ns.getMoneySources().sinceInstall);
    await ns.asleep(CONFIG.moneyTrackerCadence);
}
