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

type PickByType<T, U> = Pick<T, {
    [K in keyof T]: T[K] extends U ? K : never
}[keyof T]>;

type ResolveFn = (value: number) => void;

interface StatListener<T> {
    stat: T;
    condition: Condition;
    threshold: number;
    resolve: ResolveFn;
}

function pickByType<T, V>(
    obj: T,
    isV: (x: unknown) => x is V
): PickByType<T, V> {
    const result = {} as PickByType<T, V>;
    for (const key in obj) {
        const val = obj[key];
        if (isV(val)) {
            // TS knows `key` is one of the ValueFilter keys
            (result as any)[key] = val;
        }
    }
    return result;
}

type Sample<Type> = { t: number } & PickByType<Type, number>;

function sample<T>(obj: T): Sample<T> {
    return {
        t: Date.now(),
        ...pickByType(obj, (v): v is number => typeof v === 'number')
    };
}

class StatTracker<Type> {
    historyLen: number;
    history: Sample<Type>[] = [];
    listeners: StatListener<keyof PickByType<Type, number>>[] = [];

    constructor(historyLen?: number) {
        this.historyLen = historyLen ?? 3;
    }

    when(stat: keyof PickByType<Type, number>, condition: Condition, threshold: number) {
        const { promise, resolve } = Promise.withResolvers();
        this.listeners.push({ stat, condition, threshold, resolve });
        return promise;
    }

    update(next: Type) {
        const stats = sample(next);
        this.history.push(stats);
        if (this.history.length > this.historyLen)
            this.history.shift();

        let remaining = [];
        for (const l of this.listeners) {
            const stat = stats[l.stat];
            const compare = compareBy(l.condition);
            if (typeof stat === "number" && compare(stat, l.threshold)) {
                l.resolve(stat);
            } else {
                remaining.push(l);
            }
        }
        this.listeners = remaining;
    }
}

class GangTracker extends StatTracker<GangGenInfo> {
    ns: NS;
    members: Record<string, MemberTracker> = {};

    constructor(ns: NS) {
        super();
        this.ns = ns;
        const members = ns.gang.getMemberNames();
        for (const name of members) {
            this.members[name] = new MemberTracker(ns, name);
        }
    }

    pushMember(name: string) {
        this.members[name] = new MemberTracker(this.ns, name);
    }

    tick(deltaT?: number) {
        const gangInfo: GangGenInfo = this.ns.gang.getGangInformation();
        this.update(gangInfo);

        for (const name in this.members) {
            this.members[name].tick(deltaT);
        }
    }
}

class MemberTracker extends StatTracker<GangMemberInfo> {
    ns: NS;
    name: string;
    info: GangMemberInfo;

    constructor(ns: NS, name: string) {
        super();
        this.ns = ns;
        this.name = name;
        this.info = ns.gang.getMemberInformation(name);
    }

    tick(deltaT: number) {
        this.info = this.ns.gang.getMemberInformation(this.name)
        this.update(this.info);
    }
}
