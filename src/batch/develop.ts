import type { AutocompleteData, NS } from "netscript";

import { getRootAccess, usableHosts, weakenAnalyze } from '../lib.js';
import { walkNetworkBFS } from "../walk-network.js";

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.servers;
}

const weakenScript = '/batch/weaken.js';

const scriptList = [weakenScript];

export async function main(ns: NS) {
    const flags = ns.flags([
        ['help', false],
    ]);
    if (flags._.length === 0 || flags.help) {
        ns.tprint("This script prepares a server for batch hacking and then starts continuous batch hacking rounds against it.");
        ns.tprint(`USAGE: run ${ns.getScriptName()} SERVER_NAME`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()} n00dles`);
        return;
    }

    const target = flags._[0];
    ns.run("monitor.js", 1, target);

    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());
    let hosts = usableHosts(ns, allHosts);

    // Deploy all batch scripts to all host servers
    for (const host of hosts) {
        getRootAccess(ns, host);
        await ns.scp(scriptList, host);
    }
}
