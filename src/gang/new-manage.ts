import type { GangGenInfo, GangMemberInfo, NS } from "netscript";

import { CONFIG } from "gang/config";

import { StatTracker } from "util/stat-tracker";

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
