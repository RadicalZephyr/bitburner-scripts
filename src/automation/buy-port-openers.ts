import type { NS } from 'netscript';

export async function main(ns: NS) {
    await buyPortOpeners(ns);
}

const PROGRAMS = [
    'BruteSSH.exe',
    'FTPCrack.exe',
    'relaySMTP.exe',
    'HTTPWorm.exe',
    'SQLInject.exe',
];

async function buyPortOpeners(ns: NS) {
    for (const prog of PROGRAMS) {
        if (ns.fileExists(prog, 'home')) continue;
        const cost = ns.singularity.getDarkwebProgramCost(prog);
        await moneyAtLeast(ns, cost);
        if (!ns.singularity.purchaseProgram(prog))
            throw new Error(`failed to purchase ${prog} from the darkweb`);
    }
}

async function moneyAtLeast(ns: NS, targetMoney: number) {
    while (getPlayerMoney(ns) < targetMoney) {
        await ns.asleep(10_000);
    }
}

function getPlayerMoney(ns: NS): number {
    return ns.getServerMoneyAvailable('home');
}
