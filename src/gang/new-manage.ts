import type { GangGenInfo, NS } from "netscript";

import { CONFIG } from "gang/config";

const MAX_GANG_MEMBERS = 12;

const NAMES = [
    "Hamma",
    "Ruwen",

    "Sift",
    "Lylan",

    "Madda",
    "Padda",

    "Overlord",
    "Uruziel",

    "Kysandra",
    "Tremain",

    "Eiru",
    "Miranda",
];

export async function main(ns: NS) {
    const flags = ns.flags([
        ["help", false],
    ]);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Automate gang recruitment and task assignments.

Example:
  > run ${ns.getScriptName()}

CONFIG VALUES
  GANG_ascendThreshold   Ascension multiplier required to ascend
  GANG_trainingPercent   Fraction of members training
  GANG_maxWantedPenalty  Maximum wanted penalty before cooling
  GANG_minWantedLevel    Wanted level where heating resumes
  GANG_jobCheckInterval  Delay between evaluations
`);
        return;
    }

    if (!ns.gang.inGang()) {
        ns.tprint("No gang to manage.");
        return;
    }

    const memberNames = ns.gang.getMemberNames();
    const currentNames = new Set(memberNames);
    const availableNames = NAMES.filter(n => !currentNames.has(n));
    let nameIndex = 0;

    const isHackingGang = ns.gang.getGangInformation().isHacking;

    const gangTracker = new GangTracker(ns);

    printWantedHigh(ns, gangTracker);

    let deltaT = 0;
    while (true) {
        if (ns.gang.canRecruitMember() && nameIndex < availableNames.length) {
            const name = availableNames[nameIndex++];
            if (ns.gang.recruitMember(name)) {
                memberNames.push(name);
            }
        }

        gangTracker.tick();
        deltaT = await ns.gang.nextUpdate();
    }
}

type GangStat = keyof GangGenInfo;
type ResolveFn = (value: number) => void;

interface GangListener {
    stat: GangStat;
    threshold: number;
    resolve: ResolveFn;
}

class GangTracker {
    ns: NS;
    listeners: GangListener[] = [];

    constructor(ns: NS) {
        this.ns = ns;
    }

    whenGreater(stat: GangStat, threshold: number) {
        const { promise, resolve } = Promise.withResolvers();
        this.listeners.push({ stat, threshold, resolve });
        return promise;
    }

    tick() {
        const gangInfo: GangGenInfo = this.ns.gang.getGangInformation();

        for (const l of this.listeners) {
            const stat = gangInfo[l.stat];
            if (typeof stat === "number" && stat >= l.threshold) {
                l.resolve(stat);
            }
        }
    }
}

async function printWantedHigh(ns: NS, gangTracker: GangTracker) {
    let running = true;
    ns.atExit(() => {
        running = false;
    }, "cleanup-printWantedHigh");

    while (running) {
        const wantedLevel = await gangTracker.whenGreater("wantedLevel", 1.1);
        ns.tprint(`wanted level rising: ${wantedLevel}`);
    }
}
