import type { GangTaskStats, NS } from "netscript";

export async function main(ns: NS) {
    ns.disableLog('ALL');
    ns.clearLog();
    ns.tail();

    const headers = ['task', 'diff', '$', 'res', 'want', 'T$', 'Tres', 'Twant', 'hak', 'str', 'def', 'dex', 'agi', 'cha'];
    const statFns: ((t: GangTaskStats) => string)[] = [
        t => t.name,
        t => '' + t.difficulty.toFixed(1),
        t => '' + t.baseMoney.toFixed(2),
        t => '' + t.baseRespect,
        t => '' + t.baseWanted,
        t => '' + t.territory.money.toFixed(1),
        t => '' + t.territory.respect.toFixed(1),
        t => '' + t.territory.wanted.toFixed(2),
        t => '' + t.hackWeight.toFixed(0),
        t => '' + t.strWeight.toFixed(0),
        t => '' + t.defWeight.toFixed(0),
        t => '' + t.dexWeight.toFixed(0),
        t => '' + t.agiWeight.toFixed(0),
        t => '' + t.chaWeight.toFixed(0)
    ];

    let tasks = ns.gang.getTaskNames().map(t => ns.gang.getTaskStats(t)).filter(t => isCrime(t));
    tasks.sort((a, b) => a.difficulty - b.difficulty);

    const statLengths = statFns.map((statFn, index) => Math.max(headers[index].length, ...tasks.map(t => statFn(t).length)));

    const baseFormatString = ' %-' + statLengths[0] + 's |' +
        '  %' + statLengths[1] + 's' +
        '  %' + statLengths[2] + 's' +
        '  %-' + statLengths[3] + 's' +
        '  %-' + statLengths.slice(4).join('s  %') + 's';
    const dividerFormatString = baseFormatString.replaceAll(' ', '-').replaceAll('%', "%'-");

    const blanks = Array(headers.length).fill('');

    ns.printf(baseFormatString, ...headers);
    ns.printf(dividerFormatString, ...blanks);

    for (const task of tasks) {
        const stats = statFns.map(statFn => statFn(task));
        ns.printf(baseFormatString, ...stats);
    }

    tasks.sort(byTaskValue);

    const bestTask: GangTaskStats = tasks[tasks.length - 1];

    ns.printf('\nBest task is %s\n', bestTask.name);
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
    "Unassigned",
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
