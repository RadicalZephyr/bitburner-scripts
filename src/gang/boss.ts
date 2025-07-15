import type { NS } from "netscript";

interface Thresholds {
    trainLevel: number;
    ascendMult: number;
}

const thresholdsByCount: Record<number, Thresholds> = {
    3: { trainLevel: 500, ascendMult: 1.00 },
    6: { trainLevel: 1000, ascendMult: 0.80 },
    9: { trainLevel: 5000, ascendMult: 0.5 },
    12: { trainLevel: 10000, ascendMult: 0.2 },
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

    const currentNames = new Set(ns.gang.getMemberNames());
    const availableNames = NAMES.filter(n => !currentNames.has(n));
    let nameIndex = 0;

    const memberState: Record<string, MemberState> = {};
    for (const name of currentNames) {
        memberState[name] = "ready";
    }

    const trainingTask = ns.gang.getGangInformation().isHacking ?
        "Train Hacking" : "Train Combat";

    while (true) {
        if (
            ns.gang.canRecruitMember() &&
            ns.gang.getGangInformation().respect >= ns.gang.respectForNextRecruit() &&
            ns.gang.getMemberNames().length < MAX_MEMBERS &&
            nameIndex < availableNames.length
        ) {
            const name = availableNames[nameIndex++];
            if (ns.gang.recruitMember(name)) {
                currentNames.add(name);
                memberState[name] = "bootstrapping";
            }
        }

        const thresholds = getThresholds(ns.gang.getMemberNames().length);

        for (const name of ns.gang.getMemberNames()) {
            if (!(name in memberState)) memberState[name] = "bootstrapping";

            if (memberState[name] === "bootstrapping") {
                ns.gang.setMemberTask(name, trainingTask);
                const result = ns.gang.getAscensionResult(name);
                if (result) {
                    const maxGain = Math.max(
                        result.hack,
                        result.str,
                        result.def,
                        result.dex,
                        result.agi,
                        result.cha,
                    );

                    if (maxGain >= thresholds.ascendMult) {
                        ns.gang.ascendMember(name);
                        memberState[name] = "ready";
                    }
                }
            } else {
                ns.gang.setMemberTask(name, trainingTask);
            }
        }

        await ns.gang.nextUpdate();
    }
}
