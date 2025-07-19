import { CONFIG } from "gang/config";
function weightedStatGain(stats, profile) {
    let total = 0;
    total += ((stats.hack ?? 1) - 1) * profile.hackWeight;
    total += ((stats.str ?? 1) - 1) * profile.strWeight;
    total += ((stats.def ?? 1) - 1) * profile.defWeight;
    total += ((stats.dex ?? 1) - 1) * profile.dexWeight;
    total += ((stats.agi ?? 1) - 1) * profile.agiWeight;
    total += ((stats.cha ?? 1) - 1) * profile.chaWeight;
    return total;
}
/** Compute the return on investment time in seconds. */
export function computeROI(cost, gainRate) {
    return gainRate > 0 ? cost / gainRate : Infinity;
}
/**
 * Purchase equipment for a member when the ROI is within the allowed limit.
 *
 * @param ns - Netscript API
 * @param memberName - Gang member name
 * @param role - Role used to look up {@link CONFIG.maxROITime}
 */
export function purchaseBestGear(ns, memberName, role, moneyTracker, profile) {
    const info = ns.gang.getMemberInformation(memberName);
    const limit = CONFIG.maxROITime[role] ?? 0;
    const gainRate = moneyTracker.velocity("total");
    if (!gainRate)
        return;
    const equips = ns.gang.getEquipmentNames().map(e => computeEquipValue(ns, e, gainRate, profile));
    equips.sort(compareEquips);
    for (const equip of equips) {
        if (info.upgrades.includes(equip.name) || info.augmentations.includes(equip.name))
            continue;
        ns.print(`INFO: ROI on buying ${equip.name} is ${ns.tFormat(equip.roi * 1000)}`);
        if (equip.roi <= limit) {
            if (ns.gang.purchaseEquipment(memberName, equip.name)) {
                ns.print(`SUCCESS: buying ${memberName} ${equip.name}`);
                return;
            }
        }
    }
}
function computeEquipValue(ns, equip, gainRate, profile) {
    const cost = ns.gang.getEquipmentCost(equip);
    const stats = ns.gang.getEquipmentStats(equip);
    const effectiveGain = weightedStatGain(stats, profile);
    const roi = computeROI(cost, gainRate * effectiveGain);
    return {
        name: equip,
        stats,
        cost,
        roi,
    };
}
function compareEquips(a, b) {
    if (!isNaN(a.roi) && isFinite(a.roi) && !isNaN(b.roi) && isFinite(b.roi)) {
        return a.roi - b.roi;
    }
    else {
        return a.cost - b.cost;
    }
}
