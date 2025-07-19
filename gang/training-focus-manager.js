function normalize(v) {
    const sum = Object.values(v).reduce((a, b) => a + b, 0);
    const result = {};
    for (const k in v)
        result[k] = sum === 0 ? 0 : v[k] / sum;
    return result;
}
function distance(a, b) {
    let d = 0;
    for (const k in a)
        d += (a[k] - b[k]) ** 2;
    return Math.sqrt(d);
}
function memberVector(info) {
    const combat = info.str + info.def + info.dex + info.agi;
    const total = info.hack + combat + info.cha;
    return {
        hack: info.hack / total,
        combat: combat / total,
        cha: info.cha / total,
    };
}
function profileVector(p) {
    const combat = p.strWeight + p.defWeight + p.dexWeight + p.agiWeight;
    const total = p.hackWeight + combat + p.chaWeight;
    return {
        hack: p.hackWeight / total,
        combat: combat / total,
        cha: p.chaWeight / total,
        total,
    };
}
export function selectTrainingTask(info, profiles) {
    const m = memberVector(info);
    let bestRole = "bootstrapping";
    let bestDist = Infinity;
    for (const role of Object.keys(profiles)) {
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
    if (max === weights.cha)
        return "Train Charisma";
    if (max === weights.hack)
        return "Train Hacking";
    return "Train Combat";
}
/**
 * Assign training tasks for members by comparing their stats to role profiles.
 *
 * @param ns - Netscript API
 * @param memberNames - Names of members in training phase
 * @param profiles - Map of role profiles from {@link TaskAnalyzer}
 */
export function assignTrainingTasks(ns, memberNames, profiles) {
    for (const name of memberNames) {
        const info = ns.gang.getMemberInformation(name);
        const task = selectTrainingTask(info, profiles);
        ns.gang.setMemberTask(name, task);
    }
}
