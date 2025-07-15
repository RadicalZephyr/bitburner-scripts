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
