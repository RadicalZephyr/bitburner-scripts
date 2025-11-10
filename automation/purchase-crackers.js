import { parseFlags } from 'util/flags';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
export async function main(ns) {
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
export async function buyPortOpeners(ns) {
    await purchaseTor(ns);
    for (const prog of PROGRAMS) {
        if (ns.fileExists(prog, 'home'))
            continue;
        // SAFETY: purchaseTor ensures that we have purchased a TOR
        // router before reaching this point, and the short-circuit if
        // the file exists stops us from trying purchase a program we
        // already own. So this cost should always be positive.
        const cost = ns.singularity.getDarkwebProgramCost(prog);
        await moneyAtLeast(ns, cost);
        if (!ns.singularity.purchaseProgram(prog))
            throw new Error(`failed to purchase ${prog} from the darkweb`);
    }
}
async function purchaseTor(ns) {
    if (ns.hasTorRouter())
        return;
    await moneyAtLeast(ns, 200_000);
    if (!ns.singularity.purchaseTor())
        throw new Error('could not purchase TOR');
}
async function moneyAtLeast(ns, targetMoney) {
    while (getPlayerMoney(ns) < targetMoney) {
        await ns.asleep(10_000);
    }
}
function getPlayerMoney(ns) {
    return ns.getServerMoneyAvailable('home');
}
