import type { NS } from "netscript";
import { CONFIG } from "gang/config";
import { TaskAnalyzer } from "gang/task-analyzer";

/**
 * Assign ready gang members between money and respect tasks.
 *
 * @param ns - Netscript API
 * @param readyNames - Members eligible for work
 * @param analyzer - Precomputed task analysis
 */
export function balanceTasks(
    ns: NS,
    readyNames: string[],
    analyzer: TaskAnalyzer,
) {
    const info = ns.gang.getGangInformation();
    const respectDeficit = info.respectForNextRecruit - info.respect;
    const horizon = info.respectGainRate * CONFIG.recruitHorizon;
    const respectFraction = horizon <= 0
        ? 0
        : Math.max(0, Math.min(1, respectDeficit / horizon));

    const numRespect = Math.round(respectFraction * readyNames.length);
    const respectTask = analyzer.bestRespectTasks[0]?.name;
    const moneyTask = analyzer.bestMoneyTasks[0]?.name;

    readyNames.forEach((name, i) => {
        const task = i < numRespect ? respectTask : moneyTask;
        if (task) ns.gang.setMemberTask(name, task);
    });
}

/**
 * Assign members while respecting wanted level limits.
 *
 * When the gang's {@link GangGenInfo.wantedPenalty | wanted penalty}
 * exceeds {@link CONFIG.maxWantedPenalty}, the first `assignCoolingCount`
 * members are moved to the best cooling task from the analyzer.
 * Remaining members are distributed by {@link balanceTasks} between
 * respect and money generation.
 *
 * @param ns - Netscript API
 * @param readyNames - Members eligible for work
 * @param analyzer - Task analyzer with precomputed stats
 * @param assignCoolingCount - Number of members to assign to cooling when needed
 */
export function wantedTaskBalancer(
    ns: NS,
    readyNames: string[],
    analyzer: TaskAnalyzer,
    assignCoolingCount: number,
) {
    const info = ns.gang.getGangInformation();
    if (info.wantedPenalty > CONFIG.maxWantedPenalty) {
        const coolTask = analyzer.bestCoolingTasks[0]?.name;
        readyNames.slice(0, assignCoolingCount).forEach(name => {
            if (coolTask) ns.gang.setMemberTask(name, coolTask);
        });
        balanceTasks(ns, readyNames.slice(assignCoolingCount), analyzer);
    } else {
        balanceTasks(ns, readyNames, analyzer);
    }
}
