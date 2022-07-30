import type { NS } from "netscript";

import { getRootAccess, targetableHosts, usableHosts, walkNetworkBFS } from '../lib';

const scripts = {
    'grow': '/batch/grow.js',
    'hack': '/batch/hack.js',
    'weaken': '/batch/weaken.js'
};
const scriptList = [scripts.grow, scripts.hack, scripts.weaken];

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());

    let hosts = usableHosts(ns, allHosts);
    let targets = targetableHosts(ns, allHosts);

    ns.tprintf(
        "hosts (%d): [%s]\ntargets (%d): [%s]\n",
        hosts.length, hosts.join(", "),
        targets.length, targets.join(", ")
    );

    // Deploy all batch scripts to all host servers
    for (const host of hosts) {
        getRootAccess(ns, host);
        await ns.scp(scriptList, host);
    }

    for (const target of targets) {
        getRootAccess(ns, target);
    }
}
