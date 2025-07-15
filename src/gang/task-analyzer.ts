import type { GangMemberInfo, GangTaskStats, NS } from "netscript";

/**
 * Helper for analyzing gang tasks to determine optimal assignments.
 */
export class TaskAnalyzer {
    private ns: NS;

    tasks: GangTaskStats[] = [];
    hackTasks: GangTaskStats[] = [];
    combatTasks: GangTaskStats[] = [];
    bestMoneyTasks: GangTaskStats[] = [];
    bestRespectTasks: GangTaskStats[] = [];
    bestWarTasks: GangTaskStats[] = [];

    constructor(ns: NS) {
        this.ns = ns;
        this.refresh();
    }

    /** Refresh task statistics and recompute rankings. */
    refresh() {
        const taskNames = this.ns.gang.getTaskNames();
        this.tasks = taskNames.map(name => this.ns.gang.getTaskStats(name));
        this.hackTasks = this.tasks.filter(t => t.isHacking);
        this.combatTasks = this.tasks.filter(t => t.isCombat);

        const gangInfo = this.ns.gang.getGangInformation();
        const avgMember = this.averageMember();
        const money = new Map<GangTaskStats, number>();
        const respect = new Map<GangTaskStats, number>();

        for (const task of this.tasks) {
            money.set(task, this.ns.formulas.gang.moneyGain(gangInfo, avgMember, task));
            respect.set(task, this.ns.formulas.gang.respectGain(gangInfo, avgMember, task));
        }

        const moneySort = (a: GangTaskStats, b: GangTaskStats) =>
            (money.get(b) ?? 0) - (money.get(a) ?? 0);
        const respectSort = (a: GangTaskStats, b: GangTaskStats) =>
            (respect.get(b) ?? 0) - (respect.get(a) ?? 0);
        const warSort = (a: GangTaskStats, b: GangTaskStats) =>
            (b.territory.respect ?? 0) - (a.territory.respect ?? 0);

        this.bestMoneyTasks = [...this.tasks].sort(moneySort);
        this.bestRespectTasks = [...this.tasks].sort(respectSort);
        this.bestWarTasks = [...this.tasks].sort(warSort);
    }

    private averageMember(): GangMemberInfo {
        const names = this.ns.gang.getMemberNames();
        if (names.length === 0) {
            throw new Error("No gang members");
        }
        const sample = this.ns.gang.getMemberInformation(names[0]);
        const fields: (keyof GangMemberInfo)[] = [
            "hack", "str", "def", "dex", "agi", "cha",
            "hack_mult", "str_mult", "def_mult", "dex_mult", "agi_mult", "cha_mult",
            "hack_asc_mult", "str_asc_mult", "def_asc_mult", "dex_asc_mult",
            "agi_asc_mult", "cha_asc_mult",
        ];
        const sums: Record<string, number> = {};
        for (const f of fields) sums[f as string] = 0;

        for (const name of names) {
            const info = this.ns.gang.getMemberInformation(name);
            for (const f of fields) {
                sums[f as string] += (info as any)[f];
            }
        }

        const avg: GangMemberInfo = { ...sample };
        for (const f of fields) {
            (avg as any)[f] = sums[f as string] / names.length;
        }
        return avg;
    }
}
