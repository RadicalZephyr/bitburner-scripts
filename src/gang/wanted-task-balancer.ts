import type { NS } from "netscript";
import { CONFIG } from "gang/config";
import { balanceTasks } from "gang/task-balancer";
import { TaskAnalyzer } from "gang/task-analyzer";

/**
 * Balance respect, money and wanted level tasks based on current penalty.
 *
 * @param ns - Netscript API
 * @param readyNames - Members eligible for work
 * @param analyzer - Precomputed task analysis
 * @param assignCoolingCount - Number of members to assign to cooling when needed
 */
export function wantedTaskBalancer(
    ns: NS,
    readyNames: string[],
    analyzer: TaskAnalyzer,
    assignCoolingCount: number,
) {
    const info = ns.gang.getGangInformation();
    const { wantedPenalty } = info;

    if (wantedPenalty > CONFIG.maxWantedPenalty) {
        const coolingTask = analyzer.bestCoolingTasks[0]?.name;
        readyNames.slice(0, assignCoolingCount).forEach(name => {
            if (coolingTask) ns.gang.setMemberTask(name, coolingTask);
        });
        balanceTasks(ns, readyNames.slice(assignCoolingCount), analyzer);
    } else {
        balanceTasks(ns, readyNames, analyzer);
    }
}

