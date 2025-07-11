import type { GangGenInfo, GangMemberAscension, GangMemberInfo, NS } from "netscript";

import { CONFIG } from "gang/config";

import { Condition, PickByType, StatTracker } from "util/stat-tracker";

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

class MemberTracker {
    ns: NS;
    name: string;

    info: GangMemberInfo;
    infoTracker: StatTracker<GangMemberInfo> = new StatTracker();

    ascension: GangMemberAscension;
    ascensionTracker: StatTracker<GangMemberAscension> = new StatTracker();

    constructor(ns: NS, name: string) {
        this.ns = ns;
        this.name = name;
        this.info = this.ns.gang.getMemberInformation(this.name);
        this.ascension = this.ns.gang.getAscensionResult(this.name);
    }

    when(stat: keyof PickByType<GangMemberInfo, number>, condition: Condition, threshold: number) {
        return this.infoTracker.when(stat, condition, threshold);
    }

    whenVelocity(stat: keyof PickByType<GangMemberInfo, number>, condition: Condition, threshold: number) {
        return this.infoTracker.whenVelocity(stat, condition, threshold);
    }

    whenAscension(stat: keyof PickByType<GangMemberAscension, number>, condition: Condition, threshold: number) {
        return this.ascensionTracker.when(stat, condition, threshold);
    }

    whenAscensionVelocity(stat: keyof PickByType<GangMemberAscension, number>, condition: Condition, threshold: number) {
        return this.ascensionTracker.whenVelocity(stat, condition, threshold);
    }

    tick(deltaT: number) {
        this.info = this.ns.gang.getMemberInformation(this.name)
        this.infoTracker.update(this.info);

        this.ascension = this.ns.gang.getAscensionResult(this.name);
        if (this.ascension) {
            this.ascensionTracker.update(this.ascension);
        }
    }
}
