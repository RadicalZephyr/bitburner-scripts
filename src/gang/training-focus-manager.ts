import type { GangMemberInfo, NS } from 'netscript';

import type { RoleProfiles } from 'gang/task-analyzer';

function distance(
    a: Record<string, number>,
    b: Record<string, number>,
): number {
    let d = 0;
    for (const k in a) d += (a[k] - b[k]) ** 2;
    return Math.sqrt(d);
}

function memberVector(info: GangMemberInfo) {
    const combat = info.str + info.def + info.dex + info.agi;
    const total = info.hack + combat + info.cha;
    return {
        hack: info.hack / total,
        combat: combat / total,
        cha: info.cha / total,
    };
}

function profileVector(p: RoleProfiles[keyof RoleProfiles]) {
    const combat = p.strWeight + p.defWeight + p.dexWeight + p.agiWeight;
    const total = p.hackWeight + combat + p.chaWeight;
    return {
        hack: p.hackWeight / total,
        combat: combat / total,
        cha: p.chaWeight / total,
        total,
    };
}

export function selectTrainingTask(
    info: GangMemberInfo,
    profiles: RoleProfiles,
): string {
    const m = memberVector(info);
    let bestRole: keyof RoleProfiles = 'bootstrapping';
    let bestDist = Infinity;
    for (const role of Object.keys(profiles) as (keyof RoleProfiles)[]) {
        const p = profileVector(profiles[role]);
        const dist = distance(m, p);
        if (dist < bestDist) {
            bestDist = dist;
            bestRole = role;
        }
    }

    const w = profiles[bestRole];
    const weights = {
        hack: w.hackWeight,
        combat: w.strWeight + w.defWeight + w.dexWeight + w.agiWeight,
        cha: w.chaWeight,
    };
    const max = Math.max(weights.hack, weights.combat, weights.cha);
    if (max === weights.cha) return 'Train Charisma';
    if (max === weights.hack) return 'Train Hacking';
    return 'Train Combat';
}

/**
 * Assign training tasks for members by comparing their stats to role profiles.
 *
 * @param ns - Netscript API
 * @param memberNames - Names of members in training phase
 * @param profiles - Map of role profiles from {@link TaskAnalyzer}
 */
export function assignTrainingTasks(
    ns: NS,
    memberNames: string[],
    profiles: RoleProfiles,
) {
    for (const name of memberNames) {
        const info = ns.gang.getMemberInformation(name);
        const task = selectTrainingTask(info, profiles);
        ns.gang.setMemberTask(name, task);
    }
}
