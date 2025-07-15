import type { EquipmentStats, GangMemberInfo, NS } from "netscript";
import { CONFIG } from "gang/config";

function statGain(stats: EquipmentStats): number {
    let total = 0;
    for (const key in stats) {
        const v = stats[key];
        if (typeof v === "number") total += v - 1;
    }
    return total;
}

/** Compute the return on investment time in seconds. */
export function computeROI(cost: number, gainRate: number): number {
    return gainRate > 0 ? cost / gainRate : Infinity;
}

/**
 * Purchase equipment for a member when the ROI is within the allowed limit.
 *
 * @param ns - Netscript API
 * @param memberName - Gang member name
 * @param role - Role used to look up {@link CONFIG.maxROITime}
 */
export function purchaseBestGear(ns: NS, memberName: string, role: string) {
    const info: GangMemberInfo = ns.gang.getMemberInformation(memberName);
    const equips = ns.gang.getEquipmentNames();
    const limit = CONFIG.maxROITime[role] ?? Infinity;

    for (const equip of equips) {
        if (info.upgrades.includes(equip) || info.augmentations.includes(equip)) continue;
        const stats: EquipmentStats = ns.gang.getEquipmentStats(equip);
        const cost = ns.gang.getEquipmentCost(equip);
        const gainRate = statGain(stats);
        const roi = computeROI(cost, gainRate);
        if (roi <= limit) {
            ns.gang.purchaseEquipment(memberName, equip);
        }
    }
}
