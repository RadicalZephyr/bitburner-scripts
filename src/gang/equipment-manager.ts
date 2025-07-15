import type { NS, EquipmentStats } from "netscript";
import { CONFIG } from "gang/config";
import type { Role } from "gang/task-analyzer";

export function calculateROI(cost: number, gainRate: number): number {
    return gainRate <= 0 ? Infinity : cost / gainRate;
}

function statGain(stats: EquipmentStats): number {
    let total = 0;
    for (const key in stats) {
        const v = stats[key];
        if (typeof v === "number") total += v - 1;
    }
    return total;
}

/**
 * Purchase equipment for a gang member when the return on investment is below
 * the configured threshold for their role.
 *
 * @param ns - Netscript API
 * @param memberName - Name of the gang member
 * @param role - Role the member is fulfilling
 */
export function purchaseBestGear(ns: NS, memberName: string, role: Role) {
    const equipNames = ns.gang.getEquipmentNames();
    for (const equip of equipNames) {
        if (ns.gang.getEquipmentType(equip) === "Augmentation") continue;
        if (ns.gang.getMemberInformation(memberName).upgrades.includes(equip)) continue;
        const stats = ns.gang.getEquipmentStats(equip);
        const cost = ns.gang.getEquipmentCost(equip);
        const gainRate = statGain(stats);
        const roi = calculateROI(cost, gainRate);
        const limit = (CONFIG.maxROITime as Record<Role, number>)[role] ?? Infinity;
        if (roi <= limit) {
            ns.gang.purchaseEquipment(memberName, equip);
        }
    }
}
