import type { NS } from "netscript";
import type { AllHostInfo, HostInfo } from 'all-hosts';

import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);

    const pservPrefix = /^pserv-/;
    let allHosts = new Set(Array(...network.keys()).filter((h) => h !== "home" && !pservPrefix.test(h)));

    let allServerInfo: AllHostInfo = {};
    let hostsByPortsRequired: string[][] = Array.from({ length: 6 }, (_v, _i) => []);
    let targetsByPortsRequired: string[][] = Array.from({ length: 6 }, (_v, _i) => []);

    for (const host of allHosts) {
        // Skip home and personal servers
        if (host === 'home' || pservPrefix.test(host)) {
            continue;
        }

        let hostInfo = getHostInfo(ns, network, host);
        allServerInfo[host] = hostInfo;

        // If there's no usable RAM, then don't record this host in
        // the nukable hosts list.
        if (hostInfo.maxRam !== 0) {
            let portsRequired = hostInfo.numOpenPortsRequired;
            if (typeof portsRequired === 'number' && 0 <= portsRequired && portsRequired <= 5) {
                hostsByPortsRequired[portsRequired].push(host);
            }
        }

        if (hostInfo.moneyMax > 0) {
            let portsRequired = hostInfo.numOpenPortsRequired;
            if (typeof portsRequired === 'number' && 0 <= portsRequired && portsRequired <= 5) {
                targetsByPortsRequired[portsRequired].push(host);
            }
        }
    }

    const allHostsFile = '/all-hosts.js';
    let content = ns.sprintf(
        "export const ALL_HOSTS = %s;\n"
        + "export const ALL_SERVER_INFO = %s;\n"
        + "export const HOSTS_BY_PORTS_REQUIRED = %s;\n"
        + "export const TARGETS_BY_PORTS_REQUIRED = %s;\n",
        JSON.stringify(Array(...allHosts), null, 2),
        JSON.stringify(allServerInfo, null, 2),
        JSON.stringify(hostsByPortsRequired, null, 2),
        JSON.stringify(targetsByPortsRequired, null, 2)
    );
    ns.write(allHostsFile, content, "w");
}

function getHostInfo(ns: NS, network: Map<string, string[]>, hostname: string): HostInfo {
    return {
        hostname: hostname,
        numOpenPortsRequired: ns.getServerNumPortsRequired(hostname),
        maxRam: ns.getServerMaxRam(hostname),
        moneyMax: ns.getServerMaxMoney(hostname),
        serverGrowth: ns.getServerGrowth(hostname),
        // hackDifficulty: ns.getServer(hostname), //
        minDifficulty: ns.getServerMinSecurityLevel(hostname),
        requiredHackingSkill: ns.getServerRequiredHackingLevel(hostname),
        reachableHosts: network.get(hostname)
    };
}
