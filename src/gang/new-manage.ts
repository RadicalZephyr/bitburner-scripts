import type { GangGenInfo, GangMemberInfo, NS } from "netscript";

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
] as const;

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

    gangTracker.tick();

    let deltaT = 0;
    while (true) {
        if (ns.gang.canRecruitMember() && nameIndex < availableNames.length) {
            const name = availableNames[nameIndex++];
            if (ns.gang.recruitMember(name)) {
                memberNames.push(name);
                gangTracker.pushMember(name);
            }
        }

        deltaT = await ns.gang.nextUpdate();
        gangTracker.tick(deltaT);
    }
}

enum Condition {
    GreaterThan,
    LessThan,
}

function compareBy(condition: Condition): (a: number, b: number) => boolean {
    switch (condition) {
        case Condition.GreaterThan:
            return (a, b) => a > b;
        case Condition.LessThan:
            return (a, b) => a < b;
        default:
            const _exhaustiveCheck: never = condition;
            return _exhaustiveCheck;
    }
}

type MemberStat = keyof Omit<GangMemberInfo, "name" | "task" | "upgrades" | "augmentations" | "expGain">;
type GangStat = keyof Omit<GangGenInfo, "faction" | "isHacking" | "territoryWarfareEngaged">;

type ResolveFn = (value: number) => void;

interface StatListener<T> {
    stat: T;
    condition: Condition;
    threshold: number;
    resolve: ResolveFn;
}

class GangTracker {
    ns: NS;
    members: Record<string, MemberTracker> = {};
    listeners: StatListener<GangStat>[] = [];

    constructor(ns: NS) {
        this.ns = ns;
        const members = ns.gang.getMemberNames();
        for (const name of members) {
            this.members[name] = new MemberTracker(ns, name);
        }
    }

    pushMember(name: string) {
        this.members[name] = new MemberTracker(this.ns, name);
    }

    when(stat: GangStat, condition: Condition, threshold: number) {
        const { promise, resolve } = Promise.withResolvers();
        this.listeners.push({ stat, condition, threshold, resolve });
        return promise;
    }

    tick(deltaT?: number) {
        const gangInfo: GangGenInfo = this.ns.gang.getGangInformation();

        for (const l of this.listeners) {
            const stat = gangInfo[l.stat];
            const compare = compareBy(l.condition);
            if (typeof stat === "number" && compare(stat, l.threshold)) {
                l.resolve(stat);
            }
        }

        for (const name in this.members) {
            this.members[name].tick(deltaT);
        }
    }
}

class MemberTracker {
    ns: NS;
    name: string;
    info: GangMemberInfo;
    listeners: StatListener<MemberStat>[] = [];

    constructor(ns: NS, name: string) {
        this.ns = ns;
        this.name = name;
        this.info = ns.gang.getMemberInformation(name);
    }

    when(stat: MemberStat, condition: Condition, threshold: number) {
        const { promise, resolve } = Promise.withResolvers();
        this.listeners.push({ stat, condition, threshold, resolve });
        return promise;
    }

    tick(deltaT: number) {
        this.info = this.ns.gang.getMemberInformation(this.name)

        for (const l of this.listeners) {
            const stat = this.info[l.stat];
            const compare = compareBy(l.condition);
            if (typeof stat === "number" && compare(stat, l.threshold)) {
                l.resolve(stat);
            }
        }
    }
}
