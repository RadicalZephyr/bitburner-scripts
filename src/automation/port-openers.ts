import type { NS, AutocompleteData } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Buy all port opening programs as money becomes available.

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await buyPortOpeners(ns);
}

const PROGRAMS = [
    'BruteSSH.exe',
    'FTPCrack.exe',
    'relaySMTP.exe',
    'HTTPWorm.exe',
    'SQLInject.exe',
];

/**
 * Buy all port opening programs as money becomes available.
 *
 * @param ns - Netscript API instance
 */
export async function buyPortOpeners(ns: NS) {
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
