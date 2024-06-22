import type { NS, AutocompleteData } from "netscript";

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

/** Calculate the number of threads to soften any server by the given amount.
 */
export function softenThreads(softenAmount: number): number {
    // We multiply by 20 because 1 thread of weaken reduces security
    // by a fixed amount of 0.05, or 1/20
    return Math.ceil(softenAmount * 20);
}

/** Calculate the number of threads needed to build the server by a
 * certain multiplier.
 */
function buildAnalyze(ns: NS, target: string, buildAmount: number): number {
    if (buildAmount >= 1) {
        return Math.ceil(ns.growthAnalyze(target, buildAmount, 1));
    } else {
        return 0;
    }
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['refreshrate', 200],
        ['help', false],
    ]);
    if (flags._.length === 0 || flags.help || typeof flags.refreshrate != 'number') {

        ns.tprint(`USAGE: run ${ns.getScriptName()} SERVER_NAME

This script helps visualize the money and security of a server.

OPTIONS
 --refreshrate   Time to sleep between refreshing server data

Example:

> run ${ns.getScriptName()} n00dles
`);
        return;
    }
    ns.disableLog('ALL');
    ns.clearLog();
    ns.tail();
    ns.resizeTail(450, 30 * 6);

    const server = flags._[0];
    const maxMoney = ns.getServerMaxMoney(server);
    const minSec = ns.getServerMinSecurityLevel(server);

    while (true) {
        let money = ns.getServerMoneyAvailable(server);
        if (money === 0) money = 1;
        const sec = ns.getServerSecurityLevel(server);
        ns.clearLog();
        ns.print(`${server}:
 $_______: ${ns.nFormat(money, "$0.000a")} / ${ns.nFormat(maxMoney, "$0.000a")} (${(money / maxMoney * 100).toFixed(2)}%)
 security: +${(sec - minSec).toFixed(2)} (${sec.toFixed(2)} / ${minSec.toFixed(2)})
 hack____: ${ns.tFormat(ns.getHackTime(server))} (t=${Math.ceil(ns.hackAnalyzeThreads(server, money))})
 grow____: ${ns.tFormat(ns.getGrowTime(server))} (t=${buildAnalyze(ns, server, maxMoney / money)})
 weaken__: ${ns.tFormat(ns.getWeakenTime(server))} (t=${softenThreads(sec - minSec)})
`);
        await ns.sleep(flags.refreshrate);
    }
}
