import { pickByType } from "util/stat-tracker";
export class TaskAnalyzer {
    ns;
    tasks = [];
    hackTasks = [];
    combatTasks = [];
    bestMoneyTasks = [];
    bestRespectTasks = [];
    bestWarTasks = [];
    bestCoolingTasks = [];
    coolingTaskList = [];
    profiles = {
        bootstrapping: emptyProfile(),
        respectGrind: emptyProfile(),
        moneyGrind: emptyProfile(),
        warfare: emptyProfile(),
        cooling: emptyProfile(),
    };
    constructor(ns) {
        this.ns = ns;
        this.refresh();
    }
    /**
     * Get the averaged stat weight profiles for each role.
     *
     * @returns Map of role to average weight profile
     */
    roleProfiles() {
        return this.profiles;
    }
    /** Refresh task statistics and recompute rankings. */
    refresh() {
        const taskNames = this.ns.gang.getTaskNames();
        this.tasks = taskNames.map(name => this.ns.gang.getTaskStats(name));
        this.hackTasks = this.tasks.filter(t => t.isHacking);
        this.combatTasks = this.tasks.filter(t => t.isCombat);
        const gangInfo = this.ns.gang.getGangInformation();
        const avgMember = this.averageMember();
        const money = new Map();
        const respect = new Map();
        const wanted = new Map();
        for (const task of this.tasks) {
            money.set(task, calculateMoneyGain(this.ns, gangInfo, avgMember, task));
            respect.set(task, calculateRespectGain(this.ns, gangInfo, avgMember, task));
            wanted.set(task, calculateWantedGain(this.ns, gangInfo, avgMember, task));
        }
        const moneySort = (a, b) => (money.get(b) ?? 0) - (money.get(a) ?? 0);
        const respectSort = (a, b) => (respect.get(b) ?? 0) - (respect.get(a) ?? 0);
        const warSort = (a, b) => (b.territory.respect ?? 0) - (a.territory.respect ?? 0);
        const wantedSort = (a, b) => (wanted.get(a) ?? 0) - (wanted.get(b) ?? 0);
        this.bestMoneyTasks = [...this.tasks].sort(moneySort);
        this.bestRespectTasks = [...this.tasks].sort(respectSort);
        this.bestWarTasks = [...this.tasks].sort(warSort);
        this.bestCoolingTasks = [...this.tasks].sort(wantedSort);
        const minWanted = Math.min(...this.bestCoolingTasks.map(t => wanted.get(t) ?? 0));
        this.coolingTaskList = this.bestCoolingTasks.filter(t => t.baseWanted < 0 || (wanted.get(t) ?? 0) === minWanted);
        this.computeRoleProfiles();
    }
    averageMember() {
        const names = this.ns.gang.getMemberNames();
        if (names.length === 0) {
            throw new Error("No gang members");
        }
        const firstMember = this.ns.gang.getMemberInformation(names[0]);
        const sample = pickByType(firstMember, (v) => typeof v === 'number');
        const fields = Object.keys(sample);
        const sums = {};
        for (const f of fields)
            sums[f] = 0;
        for (const name of names) {
            const info = this.ns.gang.getMemberInformation(name);
            for (const f of fields) {
                sums[f] += info[f];
            }
        }
        const avg = { ...sample };
        for (const f of fields) {
            avg[f] = sums[f] / names.length;
        }
        const firstMemberNonNumber = pickByType(firstMember, (v) => typeof v !== 'number');
        return { ...firstMemberNonNumber, ...avg };
    }
    computeRoleProfiles() {
        const groups = {
            bootstrapping: this.tasks.filter(t => t.name.includes("Train")),
            warfare: this.tasks.filter(t => t.name.includes("Territory")),
            cooling: this.tasks.filter(t => t.baseWanted < 0),
            respectGrind: this.tasks.filter(t => t.baseRespect > t.baseMoney && t.baseRespect > 0 && t.baseWanted >= 0),
            moneyGrind: this.tasks.filter(t => t.baseMoney >= t.baseRespect && t.baseMoney > 0 && t.baseWanted >= 0),
        };
        for (const role of Object.keys(groups)) {
            const vec = defaultVector();
            const list = groups[role];
            if (list.length === 0) {
                this.profiles[role] = vec;
                continue;
            }
            for (const task of list) {
                vec.hackWeight += task.hackWeight;
                vec.strWeight += task.strWeight;
                vec.defWeight += task.defWeight;
                vec.dexWeight += task.dexWeight;
                vec.agiWeight += task.agiWeight;
                vec.chaWeight += task.chaWeight;
            }
            const len = list.length;
            this.profiles[role] = {
                hackWeight: vec.hackWeight / len,
                strWeight: vec.strWeight / len,
                defWeight: vec.defWeight / len,
                dexWeight: vec.dexWeight / len,
                agiWeight: vec.agiWeight / len,
                chaWeight: vec.chaWeight / len,
            };
        }
    }
}
function emptyProfile() {
    return { hackWeight: 0, strWeight: 0, defWeight: 0, dexWeight: 0, agiWeight: 0, chaWeight: 0 };
}
function averageWeights(tasks) {
    const profile = emptyProfile();
    if (tasks.length === 0)
        return profile;
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
function calculateMoneyGain(ns, gang, member, task) {
    if (ns.fileExists("Formulas.exe", "home"))
        return ns.formulas.gang.moneyGain(gang, member, task);
    else
        return estimateMoneyGain(gang, member, task);
}
function estimateMoneyGain(gang, member, task) {
    if (task.baseMoney === 0)
        return 0;
    let statWeight = (task.hackWeight / 100) * member.hack +
        (task.strWeight / 100) * member.str +
        (task.defWeight / 100) * member.def +
        (task.dexWeight / 100) * member.dex +
        (task.agiWeight / 100) * member.agi +
        (task.chaWeight / 100) * member.cha;
    statWeight -= 3.2 * task.difficulty;
    if (statWeight <= 0)
        return 0;
    const territoryMult = Math.max(0.005, Math.pow(gang.territory * 100, task.territory.money) / 100);
    if (isNaN(territoryMult) || territoryMult <= 0)
        return 0;
    const respectMult = calculateWantedPenalty(gang);
    const territoryPenalty = (0.2 * gang.territory + 0.8);
    return Math.pow(5 * task.baseMoney * statWeight * territoryMult * respectMult, territoryPenalty);
}
function calculateRespectGain(ns, gang, member, task) {
    if (ns.fileExists("Formulas.exe", "home"))
        return ns.formulas.gang.respectGain(gang, member, task);
    else
        return estimateRespectGain(gang, member, task);
}
function estimateRespectGain(gang, member, task) {
    if (task.baseRespect === 0)
        return 0;
    let statWeight = (task.hackWeight / 100) * member.hack +
        (task.strWeight / 100) * member.str +
        (task.defWeight / 100) * member.def +
        (task.dexWeight / 100) * member.dex +
        (task.agiWeight / 100) * member.agi +
        (task.chaWeight / 100) * member.cha;
    statWeight -= 4 * task.difficulty;
    if (statWeight <= 0)
        return 0;
    const territoryMult = Math.max(0.005, Math.pow(gang.territory * 100, task.territory.respect) / 100);
    const territoryPenalty = (0.2 * gang.territory + 0.8);
    if (isNaN(territoryMult) || territoryMult <= 0)
        return 0;
    const respectMult = calculateWantedPenalty(gang);
    return Math.pow(11 * task.baseRespect * statWeight * territoryMult * respectMult, territoryPenalty);
}
function calculateWantedGain(ns, gang, member, task) {
    if (ns.fileExists("Formulas.exe", "home"))
        return ns.formulas.gang.wantedLevelGain(gang, member, task);
    else
        return estimateWantedGain(gang, member, task);
}
function estimateWantedGain(gang, member, task) {
    if (task.baseWanted === 0)
        return 0;
    let statWeight = (task.hackWeight / 100) * member.hack +
        (task.strWeight / 100) * member.str +
        (task.defWeight / 100) * member.def +
        (task.dexWeight / 100) * member.dex +
        (task.agiWeight / 100) * member.agi +
        (task.chaWeight / 100) * member.cha;
    statWeight -= 3.5 * task.difficulty;
    if (statWeight <= 0)
        return 0;
    const territoryMult = Math.max(0.005, Math.pow(gang.territory * 100, task.territory.wanted) / 100);
    if (isNaN(territoryMult) || territoryMult <= 0)
        return 0;
    if (task.baseWanted < 0) {
        return 0.4 * task.baseWanted * statWeight * territoryMult;
    }
    const calc = (7 * task.baseWanted) / Math.pow(3 * statWeight * territoryMult, 0.8);
    return Math.min(100, calc);
}
function calculateWantedPenalty(gang) {
    return gang.respect / (gang.respect + gang.wantedLevel);
}
function defaultVector() {
    return { hackWeight: 0, strWeight: 0, defWeight: 0, dexWeight: 0, agiWeight: 0, chaWeight: 0 };
}
