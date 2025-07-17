import type { NS } from "netscript";
import { CONFIG } from "gang/config";
import { TaskAnalyzer } from "gang/task-analyzer";

/**
 * Distribute members across respect, money, cooling and warfare tasks.
 *
 * @param ns - Netscript API
 * @param members - Members eligible for work
 * @param analyzer - Task analyzer with precomputed stats
 * @returns Map of role names to member lists
 */
export function distributeTasks(
    ns: NS,
    members: string[],
    analyzer: TaskAnalyzer,
): Record<string, string[]> {
    const info = ns.gang.getGangInformation();
    const respectDeficit = Math.max(0, info.respectForNextRecruit - info.respect);
    const horizon = info.respectGainRate * CONFIG.recruitHorizon;
    const respectFraction = horizon <= 0 ? 0 : Math.min(1, respectDeficit / horizon);

    const coolingFraction = info.wantedPenalty > CONFIG.maxWantedPenalty
        ? Math.min(1, (info.wantedPenalty - CONFIG.maxWantedPenalty) / CONFIG.maxWantedPenalty)
        : 0;

    const winChance = averageClashWinChance(ns);
    const warFraction = info.territory < 1 && winChance < 0.6 ? 0.1 : 0;

    const total = members.length;
    const numCooling = Math.round(total * coolingFraction);
    const numWar = Math.round(total * warFraction);
    const numRespect = Math.round((total - numCooling - numWar) * respectFraction);

    const coolingTask = analyzer.bestCoolingTasks[0]?.name;
    const warTask = analyzer.bestWarTasks[0]?.name;
    const respectTask = analyzer.bestRespectTasks[0]?.name;
    const moneyTask = analyzer.bestMoneyTasks[0]?.name;

    let idx = 0;
    const coolingNames = members.slice(idx, idx + numCooling);
    coolingNames.forEach(n => coolingTask && ns.gang.setMemberTask(n, coolingTask));
    idx += numCooling;

    const warNames = members.slice(idx, idx + numWar);
    warNames.forEach(n => warTask && ns.gang.setMemberTask(n, warTask));
    idx += numWar;

    const respectNames = members.slice(idx, idx + numRespect);
    respectNames.forEach(n => respectTask && ns.gang.setMemberTask(n, respectTask));
    idx += numRespect;

    const moneyNames = members.slice(idx);
    moneyNames.forEach(n => moneyTask && ns.gang.setMemberTask(n, moneyTask));

    return {
        cooling: coolingNames,
        territoryWarfare: warNames,
        respectGrind: respectNames,
        moneyGrind: moneyNames,
    };
}

function averageClashWinChance(ns: NS): number {
    const others = ns.gang.getOtherGangInformation();
    const names = Object.keys(others);
    if (names.length === 0) return 0;
    let total = 0;
    for (const n of names) total += ns.gang.getChanceToWinClash(n);
    return total / names.length;
}
