import type { GangMemberInfo, NS } from "netscript";
import type { RoleProfile } from "gang/task-analyzer";

export type RoleProfiles = Record<string, RoleProfile>;

function normalize(v: Record<string, number>): Record<string, number> {
    const sum = Object.values(v).reduce((a, b) => a + b, 0);
    const result: Record<string, number> = {};
    for (const k in v) result[k] = sum === 0 ? 0 : v[k] / sum;
    return result;
}

function distance(a: Record<string, number>, b: Record<string, number>): number {
    let d = 0;
    for (const k in a) d += (a[k] - b[k]) ** 2;
    return Math.sqrt(d);
}

function profileCategory(profile: RoleProfile): "Train Hacking" | "Train Combat" | "Train Charisma" {
    const combat = profile.strWeight + profile.defWeight + profile.dexWeight + profile.agiWeight;
    const weights = { hack: profile.hackWeight, combat, cha: profile.chaWeight };
    const max = Math.max(weights.hack, weights.combat, weights.cha);
    if (max === weights.hack) return "Train Hacking";
    if (max === weights.cha) return "Train Charisma";
    return "Train Combat";
}

export function chooseTrainingTask(info: GangMemberInfo, profiles: RoleProfiles): string {
    const memberVec = normalize({
        hack: info.hack,
        str: info.str,
        def: info.def,
        dex: info.dex,
        agi: info.agi,
        cha: info.cha,
    });

    let bestRole = Object.keys(profiles)[0];
    let bestDist = Infinity;
    for (const role in profiles) {
        const p = profiles[role];
        const profVec = normalize({
            hack: p.hackWeight,
            str: p.strWeight,
            def: p.defWeight,
            dex: p.dexWeight,
            agi: p.agiWeight,
            cha: p.chaWeight,
        });
        const d = distance(memberVec, profVec);
        if (d < bestDist) {
            bestDist = d;
            bestRole = role;
        }
    }

    return profileCategory(profiles[bestRole]);
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
        const task = chooseTrainingTask(info, profiles);
        ns.gang.setMemberTask(name, task);
    }
}
