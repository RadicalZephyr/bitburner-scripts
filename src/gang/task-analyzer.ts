import type { GangGenInfo, GangMemberInfo, GangTaskStats, NS } from "netscript";
import { pickByType, PickByType } from "util/stat-tracker";

export type Role =
    | "bootstrapping"
    | "respectGrind"
    | "moneyGrind"
    | "warfare"
    | "cooling";

export interface RoleProfile {
    hackWeight: number;
    strWeight: number;
    defWeight: number;
    dexWeight: number;
    agiWeight: number;
    chaWeight: number;
}

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
    bestCoolingTasks: GangTaskStats[] = [];
    coolingTaskList: GangTaskStats[] = [];
    private profiles: Record<Role, RoleProfile> = {
        bootstrapping: emptyProfile(),
        respectGrind: emptyProfile(),
        moneyGrind: emptyProfile(),
        warfare: emptyProfile(),
        cooling: emptyProfile(),
    };

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
        const wanted = new Map<GangTaskStats, number>();

        for (const task of this.tasks) {
            money.set(task, calculateMoneyGain(this.ns, gangInfo, avgMember, task));
            respect.set(task, calculateRespectGain(this.ns, gangInfo, avgMember, task));
            wanted.set(task, calculateWantedGain(this.ns, gangInfo, avgMember, task));
        }

        const moneySort = (a: GangTaskStats, b: GangTaskStats) =>
            (money.get(b) ?? 0) - (money.get(a) ?? 0);
        const respectSort = (a: GangTaskStats, b: GangTaskStats) =>
            (respect.get(b) ?? 0) - (respect.get(a) ?? 0);
        const warSort = (a: GangTaskStats, b: GangTaskStats) =>
            (b.territory.respect ?? 0) - (a.territory.respect ?? 0);
        const wantedSort = (a: GangTaskStats, b: GangTaskStats) =>
            (wanted.get(a) ?? 0) - (wanted.get(b) ?? 0);

        this.bestMoneyTasks = [...this.tasks].sort(moneySort);
        this.bestRespectTasks = [...this.tasks].sort(respectSort);
        this.bestWarTasks = [...this.tasks].sort(warSort);
        this.bestCoolingTasks = [...this.tasks].sort(wantedSort);

        const minWanted = Math.min(...this.bestCoolingTasks.map(t => wanted.get(t) ?? 0));
        this.coolingTaskList = this.bestCoolingTasks.filter(
            t => t.baseWanted < 0 || (wanted.get(t) ?? 0) === minWanted
        );

        this.profiles = {
            bootstrapping: averageWeights(this.tasks.filter(t => t.name.startsWith("Train"))),
            respectGrind: averageWeights(this.bestRespectTasks.slice(0, 3)),
            moneyGrind: averageWeights(this.bestMoneyTasks.slice(0, 3)),
            warfare: averageWeights(this.bestWarTasks.slice(0, 3)),
            cooling: averageWeights(this.coolingTaskList),
        };
    }

    /**
     * Get the averaged stat weight profiles for each role.
     *
     * @returns Map of role to average weight profile
     */
    roleProfiles(): Record<Role, RoleProfile> {
        return this.profiles;
    }

    private averageMember(): GangMemberInfo {
        const names = this.ns.gang.getMemberNames();
        if (names.length === 0) {
            throw new Error("No gang members");
        }

        const firstMember = this.ns.gang.getMemberInformation(names[0]);
        const sample = pickByType(firstMember, (v): v is number => typeof v === 'number');
        const fields = Object.keys(sample) as (keyof PickByType<GangMemberInfo, number>)[];

        const sums: Record<string, number> = {};
        for (const f of fields) sums[f as string] = 0;

        for (const name of names) {
            const info = this.ns.gang.getMemberInformation(name);
            for (const f of fields) {
                sums[f as string] += (info as any)[f];
            }
        }

        const avg: PickByType<GangMemberInfo, number> = { ...sample };
        for (const f of fields) {
            avg[f] = sums[f] / names.length;
        }
        const firstMemberNonNumber = pickByType(firstMember, (v): v is any => typeof v !== 'number');
        return { ...firstMemberNonNumber, ...avg };
    }
}

function emptyProfile(): RoleProfile {
    return { hackWeight: 0, strWeight: 0, defWeight: 0, dexWeight: 0, agiWeight: 0, chaWeight: 0 };
}

function averageWeights(tasks: GangTaskStats[]): RoleProfile {
    const profile = emptyProfile();
    if (tasks.length === 0) return profile;
    for (const t of tasks) {
        profile.hackWeight += t.hackWeight;
        profile.strWeight += t.strWeight;
        profile.defWeight += t.defWeight;
        profile.dexWeight += t.dexWeight;
        profile.agiWeight += t.agiWeight;
        profile.chaWeight += t.chaWeight;
    }
    profile.hackWeight /= tasks.length;
    profile.strWeight /= tasks.length;
    profile.defWeight /= tasks.length;
    profile.dexWeight /= tasks.length;
    profile.agiWeight /= tasks.length;
    profile.chaWeight /= tasks.length;
    return profile;
}

function calculateMoneyGain(ns: NS, gang: GangGenInfo, member: GangMemberInfo, task: GangTaskStats): number {
    if (ns.fileExists("Formulas.exe", "home"))
        return ns.formulas.gang.moneyGain(gang, member, task)
    else
        return estimateMoneyGain(gang, member, task);
}

function estimateMoneyGain(gang: GangGenInfo, member: GangMemberInfo, task: GangTaskStats): number {
    if (task.baseMoney === 0) return 0;
    let statWeight =
        (task.hackWeight / 100) * member.hack +
        (task.strWeight / 100) * member.str +
        (task.defWeight / 100) * member.def +
        (task.dexWeight / 100) * member.dex +
        (task.agiWeight / 100) * member.agi +
        (task.chaWeight / 100) * member.cha;

    statWeight -= 3.2 * task.difficulty;
    if (statWeight <= 0) return 0;
    const territoryMult = Math.max(0.005, Math.pow(gang.territory * 100, task.territory.money) / 100);
    if (isNaN(territoryMult) || territoryMult <= 0) return 0;
    const respectMult = calculateWantedPenalty(gang);
    const territoryPenalty = (0.2 * gang.territory + 0.8);
    return Math.pow(5 * task.baseMoney * statWeight * territoryMult * respectMult, territoryPenalty);
}

function calculateRespectGain(ns: NS, gang: GangGenInfo, member: GangMemberInfo, task: GangTaskStats): number {
    if (ns.fileExists("Formulas.exe", "home"))
        return ns.formulas.gang.respectGain(gang, member, task)
    else
        return estimateRespectGain(gang, member, task);
}

function estimateRespectGain(gang: GangGenInfo, member: GangMemberInfo, task: GangTaskStats): number {
    if (task.baseRespect === 0) return 0;
    let statWeight =
        (task.hackWeight / 100) * member.hack +
        (task.strWeight / 100) * member.str +
        (task.defWeight / 100) * member.def +
        (task.dexWeight / 100) * member.dex +
        (task.agiWeight / 100) * member.agi +
        (task.chaWeight / 100) * member.cha;
    statWeight -= 4 * task.difficulty;
    if (statWeight <= 0) return 0;
    const territoryMult = Math.max(0.005, Math.pow(gang.territory * 100, task.territory.respect) / 100);
    const territoryPenalty = (0.2 * gang.territory + 0.8);
    if (isNaN(territoryMult) || territoryMult <= 0) return 0;
    const respectMult = calculateWantedPenalty(gang);
    return Math.pow(11 * task.baseRespect * statWeight * territoryMult * respectMult, territoryPenalty);
}

function calculateWantedGain(ns: NS, gang: GangGenInfo, member: GangMemberInfo, task: GangTaskStats): number {
    if (ns.fileExists("Formulas.exe", "home"))
        return ns.formulas.gang.wantedLevelGain(gang, member, task);
    else
        return estimateWantedGain(gang, member, task);
}

function estimateWantedGain(gang: GangGenInfo, member: GangMemberInfo, task: GangTaskStats): number {
    if (task.baseWanted === 0) return 0;
    let statWeight =
        (task.hackWeight / 100) * member.hack +
        (task.strWeight / 100) * member.str +
        (task.defWeight / 100) * member.def +
        (task.dexWeight / 100) * member.dex +
        (task.agiWeight / 100) * member.agi +
        (task.chaWeight / 100) * member.cha;
    statWeight -= 3.5 * task.difficulty;
    if (statWeight <= 0) return 0;
    const territoryMult = Math.max(0.005, Math.pow(gang.territory * 100, task.territory.wanted) / 100);
    if (isNaN(territoryMult) || territoryMult <= 0) return 0;
    if (task.baseWanted < 0) {
        return 0.4 * task.baseWanted * statWeight * territoryMult;
    }
    const calc = (7 * task.baseWanted) / Math.pow(3 * statWeight * territoryMult, 0.8);

    return Math.min(100, calc);
}

function calculateWantedPenalty(gang: GangGenInfo): number {
    return gang.respect / (gang.respect + gang.wantedLevel);
}
