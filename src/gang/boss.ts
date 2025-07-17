import type { GangMemberInfo, MoneySource, NS } from "netscript";

import { TaskAnalyzer } from "gang/task-analyzer";
import { distributeTasks } from "gang/task-balancer";
import { assignTrainingTasks } from "gang/training-focus-manager";
import { purchaseBestGear } from "gang/equipment-manager";
import { CONFIG } from "gang/config";

import { StatTracker } from "util/stat-tracker";

interface Thresholds {
    trainLevel: number;
    ascendMult: number;
}

const thresholdsByCount: Record<number, Thresholds> = {
    3: { trainLevel: 500, ascendMult: 2.00 },
    6: { trainLevel: 1000, ascendMult: 1.50 },
    9: { trainLevel: 5000, ascendMult: 1.15 },
    12: { trainLevel: 10000, ascendMult: 1.05 },
};

function getThresholds(n: number): Thresholds {
    let result: Thresholds = thresholdsByCount[3];
    for (const key of Object.keys(thresholdsByCount).map(Number).sort((a, b) => a - b)) {
        if (n >= key) result = thresholdsByCount[key];
    }
    return result;
}

type MemberState =
    | "recruited"
    | "bootstrapping"
    | "training"
    | "ascending"
    | "ready"
    | "respectGrind"
    | "moneyGrind"
    | "territoryWarfare"
    | "cooling";

class Member {
    state: MemberState;
    tracker: StatTracker<GangMemberInfo>;

    constructor(state: MemberState = "bootstrapping") {
        this.state = state;
        this.tracker = new StatTracker<GangMemberInfo>();
    }
}

const MAX_MEMBERS = 12;

const NAMES = [
    "Hamma",
    "Ruwen",

    "Sift",
    "Lylan",

    "Overlord",
    "Uruziel",

    "Kysandra",
    "Tremine",

    "Madda",
    "Padda",

    "Eiru",
    "Miranda",
] as const;

/**
 * Recruit and train gang members up to the maximum allowed.
 *
 * @param ns - Netscript API
 */
export async function main(ns: NS) {
    const flags = ns.flags([
        ["help", false],
    ]);

    if (typeof flags.help !== "boolean" || flags.help) {
        ns.tprint(`USAGE: run ${ns.getScriptName()}

Automatically recruit gang members and assign them all to training.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help  Show this help message`);
        return;
    }

    if (!ns.gang.inGang()) {
        ns.tprint("No gang to manage.");
        return;
    }

    ns.disableLog("ALL");

    const currentNames = new Set(ns.gang.getMemberNames());
    const availableNames = NAMES.filter(n => !currentNames.has(n));
    let nameIndex = 0;

    ns.print(`Current members: ${Array.from(currentNames).join(", ")}`);

    const members: Record<string, Member> = {};
    for (const name of currentNames) {
        members[name] = new Member();
    }

    function recruitNew(replaced?: string) {
        if (
            ns.gang.canRecruitMember() &&
            nameIndex < availableNames.length &&
            currentNames.size < MAX_MEMBERS &&
            ns.gang.getGangInformation().respect >= ns.gang.respectForNextRecruit()
        ) {
            const recruit = availableNames[nameIndex++];
            if (ns.gang.recruitMember(recruit)) {
                const msg = replaced
                    ? `SUCCESS: replaced ${replaced} with ${recruit}`
                    : `SUCCESS: recruited ${recruit}!`;
                ns.print(msg);
                currentNames.add(recruit);
                members[recruit] = new Member();
            }
        }
    }

    const moneyTracker = new StatTracker<MoneySource>();

    while (true) {
        ns.print(`INFO: starting next tick`);

        const live = new Set(ns.gang.getMemberNames());
        for (const name of Array.from(currentNames)) {
            if (!live.has(name)) {
                currentNames.delete(name);
                availableNames.push(name as (typeof NAMES)[number]);
                delete members[name];
                recruitNew(name);
            }
        }

        recruitNew();

        const count = ns.gang.getMemberNames().length;
        const thresholds = getThresholds(count);
        const ready: string[] = [];
        const training: string[] = [];

        for (const name of ns.gang.getMemberNames()) {
            ns.print(`INFO: assigning current task for ${name}`);

            if (!(name in members)) members[name] = new Member();
            ns.print(`INFO: ${name} is ${members[name].state}`);

            const memberInfo = ns.gang.getMemberInformation(name);
            members[name].tracker.update(memberInfo);

            const maxLevel = Math.max(
                memberInfo.hack,
                memberInfo.str,
                memberInfo.def,
                memberInfo.dex,
                memberInfo.agi,
                memberInfo.cha,
            );

            if (maxLevel > thresholds.trainLevel) {
                ns.print(`SUCCESS: ${name} has finished bootstrapping!`);
                members[name].state = "ready";
            } else {
                ns.print(`SUCCESS: ${name} needs to go back to bootstrapping!`);
                members[name].state = "bootstrapping";
            }

            if (members[name].state === "bootstrapping") {
                training.push(name);
                const result = ns.gang.getAscensionResult(name);
                if (result) {
                    ns.print(
                        `INFO: ascension gains ` +
                        `hck: ${result.hack} ` +
                        `str: ${result.str} ` +
                        `def: ${result.def} ` +
                        `dex: ${result.dex} ` +
                        `agi: ${result.agi} ` +
                        `cha: ${result.cha} ` +
                        `for ${name}`
                    );
                    const maxGain = Math.max(
                        result.hack,
                        result.str,
                        result.def,
                        result.dex,
                        result.agi,
                        result.cha,
                    );

                    if (maxGain >= thresholds.ascendMult) {
                        ns.print(`SUCCESS: ascending ${name}!`);
                        ns.gang.ascendMember(name);
                        members[name].tracker.reset();
                    }
                }
            } else {
                ready.push(name);
            }

            const hist = members[name].tracker.history;
            if (hist.length >= 2) {
                const first = hist[0];
                const last = hist[hist.length - 1];
                const dt = (last.t - first.t) / 1000;
                const sumFirst = first.hack + first.str + first.def + first.dex + first.agi + first.cha;
                const sumLast = last.hack + last.str + last.def + last.dex + last.agi + last.cha;
                const vel = (sumLast - sumFirst) / dt;
                if (vel < CONFIG.velocityThreshold) {
                    if (ns.gang.ascendMember(name)) {
                        members[name].tracker.reset();
                    }
                }
            }
        }

        const analyzer = new TaskAnalyzer(ns);
        analyzer.refresh();
        assignTrainingTasks(ns, training, analyzer.roleProfiles());
        moneyTracker.update(ns.getMoneySources().sinceInstall);
        for (const n of training) purchaseBestGear(ns, n, "bootstrapping", moneyTracker);
        const assignments = distributeTasks(ns, ready, analyzer);
        for (const n of assignments.cooling) members[n].state = "cooling";
        for (const n of assignments.territoryWarfare) members[n].state = "territoryWarfare";
        for (const n of assignments.respectGrind) members[n].state = "respectGrind";
        for (const n of assignments.moneyGrind) members[n].state = "moneyGrind";

        await ns.gang.nextUpdate();
    }
}
