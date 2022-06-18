import { getRootAccess, numThreads, exploitableHosts, usableHosts } from './lib.js';
import { walkNetworkBFS } from "./walk-network.js";
let factionServers = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", "The-Cave"];
/** @param {NS} ns */
export async function main(ns) {
    let shareScript = "share.js";
    let ownedHosts = ns.getPurchasedServers();
    await shareHosts(ns, ownedHosts, shareScript, 0.75);
    let hackScript = "hack.js";
    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());
    let hosts = usableHosts(ns, allHosts);
    await shareHosts(ns, hosts, shareScript, 0.25);
    let targets = exploitableHosts(ns, allHosts);
    ns.tprintf("hosts (%d): [%s]\ntargets (%d): [%s]\n", hosts.length, hosts.join(", "), targets.length, targets.join(", "));
    await startHosts(ns, hosts, targets, hackScript);
}
/**
 *
 * @param {NS} ns
 * @param {string[]} hosts
 * @param {string} shareScript
 */
async function shareHosts(ns, hosts, shareScript, shareAmount) {
    if (!ns.fileExists(shareScript)) {
        ns.tprintf("share script '%s' does not exist", shareScript);
        return;
    }
    for (const host of hosts) {
        let threads = Math.floor(numThreads(ns, host, shareScript) * shareAmount);
        if (threads > 0) {
            ns.printf("calculated num threads of %d", threads);
            await getRootAccess(ns, host);
            await ns.scp(shareScript, host);
            ns.exec(shareScript, host, threads);
        }
    }
}
/**
 *
 * @param {NS} ns
 * @param {string[]} hosts
 * @param {string} target
 * @param {string} hackScript
 */
async function startHosts(ns, hosts, targets, hackScript) {
    if (!ns.fileExists(hackScript)) {
        ns.tprintf("hack script '%s' does not exist", hackScript);
        return;
    }
    let hackScriptRam = ns.getScriptRam(hackScript);
    for (const target of targets) {
        await getRootAccess(ns, target);
    }
    let targetIndex = 0;
    let maxSingleTargetThreads = 40;
    for (let i = 0; i < hosts.length; ++i) {
        let host = hosts[i];
        let threads = numThreads(ns, host, hackScript);
        if (threads === 0) {
            continue;
        }
        if (await getRootAccess(ns, host)) {
            await ns.scp(hackScript, host);
            if (threads > targets.length * 10) {
                let threadsPerTarget = Math.floor(threads / targets.length);
                for (const target of targets) {
                    ns.exec(hackScript, host, threadsPerTarget, target);
                }
            }
            else if (threads > maxSingleTargetThreads) {
                while (threads > maxSingleTargetThreads) {
                    let target = targets[targetIndex++ % targets.length];
                    ns.exec(hackScript, host, maxSingleTargetThreads, target);
                    threads -= maxSingleTargetThreads;
                }
                let target = targets[targetIndex++ % targets.length];
                ns.exec(hackScript, host, threads, target);
            }
            else {
                let target = targets[targetIndex++ % targets.length];
                ns.exec(hackScript, host, threads, target);
            }
        }
    }
}
