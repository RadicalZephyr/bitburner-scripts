import type {
    AutocompleteData,
    GangGenInfo,
    GangMemberAscension,
    GangMemberInfo,
    NS,
} from 'netscript';
import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';

const FLAGS = [['help', false]] satisfies [
    string,
    string | number | boolean | string[],
][];

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

import { CONFIG } from 'gang/config';
import { NAMES } from 'gang/names';

import {
    Condition,
    PickByType,
    StatTracker,
    Threshold,
} from 'util/stat-tracker';

export async function main(ns: NS) {
    const flags = ns.flags([...FLAGS, ...MEM_TAG_FLAGS]);

    if (typeof flags.help !== 'boolean' || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Automate gang recruitment and task assignments.

Example:
  > run ${ns.getScriptName()}

CONFIG VALUES
  GANG_hackTrainVelocity      The threshold for when we're done hack training
  GANG_combatTrainVelocity    The threshold for when we're done combat training
  GANG_charismaTrainVelocity  The threshold for when we're done charisma training
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    if (!ns.gang.inGang()) {
        ns.tprint('No gang to manage.');
        return;
    }

    const memberNames = ns.gang.getMemberNames();
    const currentNames = new Set(memberNames);
    const availableNames = NAMES.filter((n) => !currentNames.has(n));
    let nameIndex = 0;

    const gangTracker = new GangTracker(ns);

    gangTracker.tick();

    for (const name of ns.gang.getMemberNames()) {
        trainMember(ns, name, gangTracker.member(name));
    }

    while (true) {
        if (ns.gang.canRecruitMember() && nameIndex < availableNames.length) {
            const name = availableNames[nameIndex++];
            if (ns.gang.recruitMember(name)) {
                memberNames.push(name);
                gangTracker.pushMember(name);
            }
        }

        await ns.gang.nextUpdate();
        gangTracker.tick();
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

    member(name: string): MemberTracker {
        return this.members[name];
    }

    pushMember(name: string) {
        this.members[name] = new MemberTracker(this.ns, name);
    }

    tick() {
        const gangInfo: GangGenInfo = this.ns.gang.getGangInformation();
        this.update(gangInfo);

        for (const name in this.members) {
            this.members[name].tick();
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

    when(
        stat: keyof PickByType<GangMemberInfo, number>,
        condition: Condition,
        threshold: Threshold,
    ) {
        return this.infoTracker.when(stat, condition, threshold);
    }

    whenVelocity(
        stat: keyof PickByType<GangMemberInfo, number>,
        condition: Condition,
        threshold: Threshold,
    ) {
        return this.infoTracker.whenVelocity(stat, condition, threshold);
    }

    whenAscension(
        stat: keyof PickByType<GangMemberAscension, number>,
        condition: Condition,
        threshold: Threshold,
    ) {
        return this.ascensionTracker.when(stat, condition, threshold);
    }

    whenAscensionVelocity(
        stat: keyof PickByType<GangMemberAscension, number>,
        condition: Condition,
        threshold: Threshold,
    ) {
        return this.ascensionTracker.whenVelocity(stat, condition, threshold);
    }

    tick() {
        this.info = this.ns.gang.getMemberInformation(this.name);
        this.infoTracker.update(this.info);

        this.ascension = this.ns.gang.getAscensionResult(this.name);
        if (this.ascension) {
            this.ascensionTracker.update(this.ascension);
        }
    }

    reset() {
        this.infoTracker.reset();
        this.ascensionTracker.reset();
    }
}

async function trainMember(ns: NS, name: string, tracker: MemberTracker) {
    let running = true;
    ns.atExit(() => {
        running = false;
    }, `trainMember-${name}-cleanup`);

    while (running) {
        buyEquipment(ns, name);

        await setTask(ns, name, 'Train Hacking');
        await tracker.whenVelocity(
            'hack',
            Condition.LessThan,
            () => CONFIG.hackTrainVelocity,
        );

        await setTask(ns, name, 'Train Combat');
        await tracker.whenVelocity(
            'dex',
            Condition.LessThan,
            () => CONFIG.combatTrainVelocity,
        );

        await setTask(ns, name, 'Train Charisma');
        await tracker.whenVelocity(
            'cha',
            Condition.LessThan,
            () => CONFIG.charismaTrainVelocity,
        );

        if (ns.gang.ascendMember(name)) tracker.reset();

        await ns.gang.nextUpdate();
    }
}

async function setTask(ns: NS, name: string, task: string) {
    if (!ns.gang.setMemberTask(name, task)) {
        ns.print(`ERROR: invalid task ${task} set for ${name}`);
        ns.ui.openTail();
    }
    await ns.gang.nextUpdate();
}

function buyEquipment(ns: NS, name: string) {
    const allEquipment = ns.gang.getEquipmentNames();

    for (const e of allEquipment) {
        const type = ns.gang.getEquipmentType(e);
        // Skip augments
        if (type === 'Augments') continue;

        ns.gang.purchaseEquipment(name, e);
    }
}
