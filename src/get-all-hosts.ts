import type { NS } from "netscript";
import type { AllServerInfo } from 'all-hosts';

import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);

    const pservPrefix = /^pserv-/;
    let allHosts = new Set(Array(...network.keys()).filter((h) => h !== "home" && !pservPrefix.test(h)));

    let allServerInfo: AllServerInfo = {};
    let hostsByPortsRequired: [string, number][][] = Array.from({ length: 6 }, (_v, _i) => []);

    for (const host of allHosts) {
        // Skip home and personal servers
        if (host === 'home' || pservPrefix.test(host)) {
            continue;
        }

        let server = ns.getServer(host);
        allServerInfo[host] = {
            hostname: host,
            server: server,
            reachableHosts: network.get(host)
        };

        // If there's no usable RAM, then don't record this host in
        // the nukable hosts list.
        if (server.maxRam === 0) {
            continue;
        }
        let portsRequired = server.numOpenPortsRequired;
        if (typeof portsRequired === 'number' && 0 <= portsRequired && portsRequired <= 5) {
            hostsByPortsRequired[portsRequired].push([host, server.maxRam]);
        }
    }

    for (let hosts of hostsByPortsRequired) {
        hosts.sort((a, b) => b[1] - a[1]);
        let maxRam = hosts[0][1];
        while (hosts.at(-1)[1] < maxRam) {
            hosts.pop();
        }
    }

    const allHostsFile = '/all-hosts.js';
    let content = ns.sprintf(
        "export const ALL_HOSTS = %s;\n"
        + "export const ALL_SERVER_INFO = %s;\n"
        + "export const HOSTS_BY_PORTS_REQUIRED = %s;\n",
        JSON.stringify(Array(...allHosts), null, 2),
        JSON.stringify(allServerInfo, null, 2),
        JSON.stringify(hostsByPortsRequired, null, 2)
    );
    ns.write(allHostsFile, content, "w");
}
