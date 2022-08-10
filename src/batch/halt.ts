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
USAGE: run ${ns.getScriptName()} TARGET_HOST...

Halt all batch hacking threads targeting the TARGET HOST.

OPTIONS
  --help   Show this help message
`);
        return;
    }

    const allHosts = getAllHosts(ns);
    const allTargetThreads = countThreadsByTarget(ns, allHosts);

    for (const target of options._) {
        const targetInfo = allTargetThreads.get(target);
        if (targetInfo) {
            const milkPid = targetInfo.hPid.shift();
            ns.kill(milkPid);
            await ns.sleep(500);

            targetInfo.hPid.forEach(pid => ns.kill(pid));
            await ns.sleep(500);

            const buildPid = targetInfo.hPid.shift();
            ns.kill(buildPid);
            await ns.sleep(500);

            targetInfo.gPid.forEach(pid => ns.kill(pid));
            await ns.sleep(500);

            targetInfo.wPid.forEach(pid => ns.kill(pid));
            await ns.sleep(10);
        } else {
            ns.tprintf('nothing to kill for target %s', target);
        }
    }
}
