import type { NS, AutocompleteData } from "netscript";

import { getAllHosts, countThreadsByTarget } from '../lib';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const options = ns.flags([
        ['help', false]
    ]);

    if (options.help || options._.length < 1) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} TARGET_HOST

Halt all batch hacking threads targeting the TARGET HOST.

OPTIONS
  --help   Show this help message
`);
        return;
    }

    const allHosts = getAllHosts(ns);
    const allTargetThreads = countThreadsByTarget(ns, allHosts);

    const target = options._[0];
    const targetInfo = allTargetThreads.get(target);
    if (targetInfo) {
        targetInfo.hPid.forEach(pid => ns.kill(pid));
        await ns.sleep(150);

        targetInfo.gPid.forEach(pid => ns.kill(pid));
        await ns.sleep(150);

        targetInfo.wPid.forEach(pid => ns.kill(pid));
        await ns.sleep(150);
    } else {
        ns.tprintf('nothing to kill for target %s', target);
    }
}
