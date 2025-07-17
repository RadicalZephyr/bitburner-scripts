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
    3: { trainLevel: 500, ascendMult: 2.0 },
    6: { trainLevel: 1000, ascendMult: 1.5 },
    9: { trainLevel: 5000, ascendMult: 1.15 },
    12: { trainLevel: 10000, ascendMult: 1.05 },
};

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function getThresholds(n: number): Thresholds {
    const keys = Object.keys(thresholdsByCount)
        .map(Number)
        .sort((a, b) => a - b);

    if (n <= keys[0]) return thresholdsByCount[keys[0]];
    if (n >= keys[keys.length - 1]) return thresholdsByCount[keys[keys.length - 1]];

    for (let i = 0; i < keys.length - 1; i++) {
        const low = keys[i];
        const high = keys[i + 1];
        if (n >= low && n <= high) {
            const t = (n - low) / (high - low);
            const lowThr = thresholdsByCount[low];
            const highThr = thresholdsByCount[high];
            return {
                trainLevel: lerp(lowThr.trainLevel, highThr.trainLevel, t),
                ascendMult: lerp(lowThr.ascendMult, highThr.ascendMult, t),
            };
        }
    }

    return thresholdsByCount[keys[0]]; // fallback, should never hit
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
    name: string;
    state: MemberState;
    private tracker: StatTracker<GangMemberInfo>;

    constructor(name: string, state: MemberState = "bootstrapping") {
        this.name = name;
        this.state = state;
        this.tracker = new StatTracker<GangMemberInfo>();
    }

    update(ns: NS) {
        const info = ns.gang.getMemberInformation(this.name);
        this.tracker.update(info);
    }

    reset() {
        this.tracker.reset();
    }

    tryAscend(ns: NS): boolean {
        if (ns.gang.ascendMember(this.name)) {
            this.reset();
            return true;
        }
        return false;
    }

    maxLevel() {
        return Math.max(
            this.tracker.value("hack"),
            this.tracker.value("str"),
            this.tracker.value("def"),
            this.tracker.value("dex"),
            this.tracker.value("agi"),
            this.tracker.value("cha"),
        );
    }

    averageVelocity(): number | undefined {
        const stats: (keyof Pick<GangMemberInfo, "hack" | "str" | "def" | "dex" | "agi" | "cha">)[] = [
            "hack",
            "str",
            "def",
            "dex",
            "agi",
            "cha",
        ];
        let total = 0;
        let count = 0;
        for (const s of stats) {
            const v = this.tracker.velocity(s);
            if (typeof v === "number") {
                total += v;
                count++;
            }
        }
        return count > 0 ? total / count : undefined;
    }
}

const MAX_MEMBERS = 12;

const NAMES = [
    "Hamma",
    "Ruwen",

    "Sift",
    "Lylan",

    "Rami",
    "Xavier",

    "Overlord",
    "Uruziel",

    "Fractal",
    "Lir",

    "Wip",
    "Qip",

    "Blizz",
    "Big D",

    "Kysandra",
    "Tremine",

    "Madda",
    "Padda",

    "Mist",
    "Thorn",

    "Dusk",
    "Tarot",

    "Nymthus",
    "Echo",

    "Chip",
    "Stump",

    "Ash",
    "Pine",

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
        members[name] = new Member(name);
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
                members[recruit] = new Member(recruit);
            }
        }
    }

    const moneyTracker = new StatTracker<MoneySource>(12);

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

            if (!(name in members)) members[name] = new Member(name);
            ns.print(`INFO: ${name} is ${members[name].state}`);

            members[name].update(ns);

            const maxLevel = members[name].maxLevel();

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
                        members[name].tryAscend(ns);
                    }
                }
            } else {
                ready.push(name);
            }

            // const vel = members[name].averageVelocity();
            // if (typeof vel === "number" && vel < CONFIG.velocityThreshold) {
            //     members[name].tryAscend(ns);
            // }
        }

        const analyzer = new TaskAnalyzer(ns);
        analyzer.refresh();
        const profiles = analyzer.roleProfiles();
        assignTrainingTasks(ns, training, profiles);
        moneyTracker.update(ns.getMoneySources().sinceInstall);
        for (const n of training) purchaseBestGear(ns, n, "bootstrapping", moneyTracker, profiles.bootstrapping);
        const assignments = distributeTasks(ns, ready, analyzer);
        for (const n of assignments.cooling) members[n].state = "cooling";
        for (const n of assignments.territoryWarfare) members[n].state = "territoryWarfare";
        for (const n of assignments.respectGrind) members[n].state = "respectGrind";
        for (const n of assignments.moneyGrind) members[n].state = "moneyGrind";

        await ns.gang.nextUpdate();
    }
}
