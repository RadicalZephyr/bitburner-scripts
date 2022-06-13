export function autocomplete(data, args) {
  return data.servers;
}

/** @param {NS} ns */
export async function main(ns) {
  const args = ns.flags([["help", false]]);
  const server = ns.args[0];
  if (args.help || !server) {
    ns.tprint("This script does a more detailed analysis of a server.");
    ns.tprint(`Usage: run ${ns.getScriptName()} SERVER`);
    ns.tprint("Example:");
    ns.tprint(`> run ${ns.getScriptName()} n00dles`);
    return;
  }
  const usedRam = ns.getServerUsedRam(server);
  const maxRam = ns.getServerMaxRam(server);
  const money = ns.getServerMoneyAvailable(server);
  const maxMoney = ns.getServerMaxMoney(server);
  const minSec = ns.getServerMinSecurityLevel(server);
  const sec = ns.getServerSecurityLevel(server);
  const grow2x = Math.ceil(ns.growthAnalyze(server, 2));
  const grow3x = Math.ceil(ns.growthAnalyze(server, 3));
  const grow4x = Math.ceil(ns.growthAnalyze(server, 4));
  const grow5x = Math.ceil(ns.growthAnalyze(server, 5));
  const grow6x = Math.ceil(ns.growthAnalyze(server, 6));
  const grow7x = Math.ceil(ns.growthAnalyze(server, 7));
  const grow8x = Math.ceil(ns.growthAnalyze(server, 8));
  const grow9x = Math.ceil(ns.growthAnalyze(server, 9));
  const grow10x = Math.ceil(ns.growthAnalyze(server, 10));
  const hack10 = Math.ceil(.10 / ns.hackAnalyze(server));
  const hack25 = Math.ceil(.25 / ns.hackAnalyze(server));
  const hack50 = Math.ceil(.50 / ns.hackAnalyze(server));
  ns.tprint(`
${server}:
    RAM        : ${usedRam} / ${maxRam} (${usedRam / maxRam * 100}%)
    $          : ${ns.nFormat(money, "$0.000a")} / ${ns.nFormat(maxMoney, "$0.000a")} (${(money / maxMoney * 100).toFixed(2)}%)
    security   : ${sec.toFixed(2)} / ${minSec.toFixed(2)} (${(sec / minSec).toFixed(2)}x)
    growth     : ${ns.getServerGrowth(server)}
    hackChance : ${(ns.hackAnalyzeChance(server) * 100).toFixed(2)}%
    hack time  : ${ns.tFormat(ns.getHackTime(server))}
    grow time  : ${ns.tFormat(ns.getGrowTime(server))}
    weaken time: ${ns.tFormat(ns.getWeakenTime(server))}
    grow x2    : ${grow2x} threads
    grow x3    : ${grow3x} threads
    grow x4    : ${grow4x} threads
    grow x8    : ${grow8x} threads
    growSec+ x2: ${(ns.growthAnalyzeSecurity(grow2x)).toFixed(2)} security
    growSec+ x3: ${(ns.growthAnalyzeSecurity(grow3x)).toFixed(2)} security
    growSec+ x4: ${(ns.growthAnalyzeSecurity(grow4x)).toFixed(2)} security
    growSec+ x8: ${(ns.growthAnalyzeSecurity(grow8x)).toFixed(2)} security
    hack 10%   : ${hack10} threads
    hack 25%   : ${hack25} threads
    hack 50%   : ${hack50} threads
    hackSec+10%: ${ns.hackAnalyzeSecurity(hack10).toFixed(2)} security
    hackSec+25%: ${ns.hackAnalyzeSecurity(hack25).toFixed(2)} security
    hackSec+50%: ${ns.hackAnalyzeSecurity(hack50).toFixed(2)} security
    weaken 10% : ${Math.ceil((sec - minSec) * 20 * 0.10)} threads
    weaken 25% : ${Math.ceil((sec - minSec) * 20 * 0.25)} threads
    weaken 50% : ${Math.ceil((sec - minSec) * 20 * 0.50)} threads
    weaken 75% : ${Math.ceil((sec - minSec) * 20 * 0.75)} threads
    weaken 100%: ${Math.ceil((sec - minSec) * 20 * 1.00)} threads
`);
}