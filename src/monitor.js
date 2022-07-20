import { growthAnalyze, weakenThreads } from './lib.js';

export async function main(ns) {
  const flags = ns.flags([
    ['refreshrate', 200],
    ['help', false],
  ])
  if (flags._.length === 0 || flags.help) {

    ns.tprint(`USAGE: run ${ns.getScriptName()} SERVER_NAME

This script helps visualize the money and security of a server.

OPTIONS
 --refreshrate   Time to sleep between refreshing server data

Example:

> run ${ns.getScriptName()} n00dles
`);
    return;
  }
  ns.tail();
  ns.disableLog('ALL');

  const server = flags._[0];
  const maxMoney = ns.getServerMaxMoney(server);
  const minSec = ns.getServerMinSecurityLevel(server);

  while (true) {
    let money = ns.getServerMoneyAvailable(server);
    if (money === 0) money = 1;
    const sec = ns.getServerSecurityLevel(server);
    ns.clearLog(server);
    ns.print(`${server}:
 $_______: ${ns.nFormat(money, "$0.000a")} / ${ns.nFormat(maxMoney, "$0.000a")} (${(money / maxMoney * 100).toFixed(2)}%)
 security: +${(sec - minSec).toFixed(2)} (${sec.toFixed(2)} / ${minSec.toFixed(2)})
 hack____: ${ns.tFormat(ns.getHackTime(server))} (t=${Math.ceil(ns.hackAnalyzeThreads(server, money))})
 grow____: ${ns.tFormat(ns.getGrowTime(server))} (t=${growthAnalyze(ns, server, maxMoney / money)})
 weaken__: ${ns.tFormat(ns.getWeakenTime(server))} (t=${weakenThreads(sec - minSec)})
`);
    await ns.sleep(flags.refreshrate);
  }
}

export function autocomplete(data, args) {
  return data.servers;
}
