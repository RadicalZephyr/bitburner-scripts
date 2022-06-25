import type { GangTaskStats, NS } from "netscript";

export async function main(ns: NS) {
    let tasks = ns.gang.getTaskNames().map(t => ns.gang.getTaskStats(t)).filter(t => isCrime(t));
    ns.tprint(`crime tasks: ${JSON.stringify(tasks)}`);
    tasks.sort(byTaskValue);

    const bestTask = tasks[tasks.length - 1];

    ns.tprint(`
Best task is ${bestTask.name}

Rewards:
money:   ${bestTask.baseMoney}
respect: ${bestTask.baseRespect}

Challenge:
wanted:     ${bestTask.baseWanted}
difficulty: ${bestTask.difficulty}

Stat Weights:
hak: ${bestTask.hackWeight}
str: ${bestTask.strWeight}
def: ${bestTask.defWeight}
agi: ${bestTask.agiWeight}
dex: ${bestTask.dexWeight}
cha: ${bestTask.chaWeight}
`);
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
