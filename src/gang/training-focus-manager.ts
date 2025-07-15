import type { NS, GangMemberInfo } from "netscript";
import type { RoleProfiles } from "gang/task-analyzer";

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

export function selectTrainingTask(info: GangMemberInfo, profiles: RoleProfiles): string {
    const m = memberVector(info);
    let bestRole: keyof RoleProfiles = "bootstrapping";
    let bestDist = Infinity;
    for (const role of Object.keys(profiles) as (keyof RoleProfiles)[]) {
        const p = profileVector(profiles[role]);
        const dist = Math.sqrt(
            Math.pow(m.hack - p.hack, 2) +
            Math.pow(m.combat - p.combat, 2) +
            Math.pow(m.cha - p.cha, 2)
        );
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
    if (max === weights.cha) return "Train Charisma";
    if (max === weights.hack) return "Train Hacking";
    return "Train Combat";
}

/**
 * Assign training tasks for the given members based on role profiles.
 *
 * @param ns - Netscript API
 * @param memberNames - Names of members to assign
 * @param profiles - Role profile weight vectors
 */
export function assignTrainingTasks(ns: NS, memberNames: string[], profiles: RoleProfiles) {
    for (const name of memberNames) {
        const info = ns.gang.getMemberInformation(name);
        const task = selectTrainingTask(info, profiles);
        ns.gang.setMemberTask(name, task);
    }
}
