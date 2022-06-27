import type { GangTaskStats, NS } from "netscript";

export async function main(ns: NS) {
    ns.disableLog('ALL');
    ns.clearLog();
    ns.tail();

    let tasks = ns.gang.getTaskNames().map(t => ns.gang.getTaskStats(t)).filter(t => isCrime(t));

    const longestTaskName = Math.max(...tasks.map(t => t.name.length));

    const baseFormatString = ` %${longestTaskName}s | %5s %5s %5s %5s %5s %5s %5s %5s %5s %5s %5s %5s %5s`;
    const dividerFormatString = baseFormatString.replaceAll(' ', '-').replaceAll('%', "%'-");

    const headers = ['task', '$', 'res', 'want', 'diff', 'terr $', 'terr res', 'terr want', 'hak', 'str', 'def', 'dex', 'agi', 'cha'];
    const blanks = Array(headers.length).fill('');

    ns.printf(baseFormatString, headers);
    ns.printf(dividerFormatString, ...blanks);

    for (const task of tasks) {
        const stats = [
            task.name,
            task.baseMoney, task.baseRespect,
            task.baseWanted, task.difficulty,
            task.territory.money, task.territory.respect, task.territory.wanted,
            task.hackWeight, task.strWeight, task.defWeight,
            task.dexWeight, task.agiWeight, task.chaWeight
        ];
        ns.printf(baseFormatString, ...stats);
    }

    tasks.sort(byTaskValue);

    const bestTask: GangTaskStats = tasks[tasks.length - 1];

    ns.printf('Best task is %s', bestTask.name);
}

function byTaskValue(t1: GangTaskStats, t2: GangTaskStats): number {
    return taskValue(t1) - taskValue(t2);
}

function taskValue(t: GangTaskStats): number {
    const value = t.baseMoney + t.baseRespect;
    const challenge = t.baseWanted + t.difficulty;
    return value / challenge;

}

const nonCrimes = [
    "Ethical Hacking",
    "Vigilante Justice",
    "Train Combat",
    "Train Hacking",
    "Train Charisma",
    "Territory Warfare"
];

function isCrime(t: GangTaskStats): boolean {
    return !nonCrimes.includes(t.name);
}
