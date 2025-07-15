import type { NS, GangMemberInfo } from "netscript";
import { TaskAnalyzer } from "gang/task-analyzer";
import { wantedTaskBalancer } from "gang/task-balancer";
import { assignTrainingTasks } from "gang/training-focus-manager";
import { purchaseBestGear } from "gang/equipment-manager";
import { StatTracker } from "util/stat-tracker";
import { CONFIG } from "gang/config";

interface Thresholds {
    trainLevel: number;
    ascendMult: number;
}

const thresholdsByCount: Record<number, Thresholds> = {
    3: { trainLevel: 500, ascendMult: 1.00 },
    6: { trainLevel: 1000, ascendMult: 1.50 },
    9: { trainLevel: 5000, ascendMult: 2.0 },
    12: { trainLevel: 10000, ascendMult: 3.0 },
};

function getThresholds(n: number): Thresholds {
    let result: Thresholds = thresholdsByCount[3];
    for (const key of Object.keys(thresholdsByCount).map(Number).sort((a, b) => a - b)) {
        if (n >= key) result = thresholdsByCount[key];
    }
    return result;
}

type MemberState = "bootstrapping" | "ready";

const MAX_MEMBERS = 12;

const NAMES = [
    "Hamma",
    "Ruwen",

    "Sift",
    "Lylan",

    "Overlord",
    "Uruziel",

    "Kysandra",
    "Tremain",

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

    const memberState: Record<string, MemberState> = {};
    for (const name of currentNames) {
        memberState[name] = "bootstrapping";
    }

    const trackers: Record<string, StatTracker<GangMemberInfo>> = {};
    for (const name of currentNames) {
        trackers[name] = new StatTracker();
    }


    while (true) {
        ns.print(`INFO: starting next tick`);
        if (
            ns.gang.canRecruitMember() &&
            ns.gang.getGangInformation().respect >= ns.gang.respectForNextRecruit() &&
            ns.gang.getMemberNames().length < MAX_MEMBERS &&
            nameIndex < availableNames.length
        ) {
            const name = availableNames[nameIndex++];
            if (ns.gang.recruitMember(name)) {
                ns.print(`SUCCESS: recruited ${name}!`);
                currentNames.add(name);
                memberState[name] = "bootstrapping";
                trackers[name] = new StatTracker();
            }
        }

        const thresholds = getThresholds(ns.gang.getMemberNames().length);
        const ready: string[] = [];
        const training: string[] = [];

        for (const name of ns.gang.getMemberNames()) {
            ns.print(`INFO: assigning current task for ${name}`);
            const memberInfo = ns.gang.getMemberInformation(name);

            if (!(name in memberState)) memberState[name] = "bootstrapping";
            ns.print(`INFO: ${name} is ${memberState[name]}`);

            if (memberState[name] === "bootstrapping") {
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
                    memberState[name] = "ready";
                }

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
                        trackers[name].reset();
                    }
                }
            } else {
                ready.push(name);
            }

            trackers[name] = trackers[name] || new StatTracker<GangMemberInfo>();
            trackers[name].update(memberInfo);
            if (trackers[name].history.length >= 2) {
                const first = trackers[name].history[0];
                const last = trackers[name].history[trackers[name].history.length - 1];
                const dt = (last.t - first.t) / 1000;
                const sumFirst = first.hack + first.str + first.def + first.dex + first.agi + first.cha;
                const sumLast = last.hack + last.str + last.def + last.dex + last.agi + last.cha;
                const vel = (sumLast - sumFirst) / dt;
                if (vel < CONFIG.velocityThreshold) {
                    if (ns.gang.ascendMember(name)) {
                        trackers[name].reset();
                    }
                }
            }
        }

        const analyzer = new TaskAnalyzer(ns);
        assignTrainingTasks(ns, training, analyzer.roleProfiles());
        for (const n of training) purchaseBestGear(ns, n, "bootstrapping");
        wantedTaskBalancer(ns, ready, analyzer, 1);

        await ns.gang.nextUpdate();
    }
}
