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
    let allTargetThreads = countThreadsByTarget(ns, allHosts);

    let targets = options._.filter((t: any) => typeof (t) === 'string' && allTargetThreads.get(t));

    for (const target of targets) {
        const targetInfo = allTargetThreads.get(target);
        const milkPid = targetInfo.hPid.shift();
        if (milkPid) ns.kill(milkPid);
        const buildPid = targetInfo.hPid.shift();
        if (buildPid) ns.kill(buildPid);
        await ns.sleep(50);
    }
    await ns.sleep(1000);

    allTargetThreads = countThreadsByTarget(ns, allHosts);
    targets = options._.filter((t: any) => typeof (t) === 'string' && allTargetThreads.get(t));

    for (const target of targets) {
        const targetInfo = allTargetThreads.get(target);
        targetInfo.hPid.forEach(pid => ns.kill(pid));
        await ns.sleep(50);
    }
    await ns.sleep(1000);

    for (const target of targets) {
        const targetInfo = allTargetThreads.get(target);
        targetInfo.gPid.forEach(pid => ns.kill(pid));
        await ns.sleep(50);
    }
    await ns.sleep(1000);

    for (const target of targets) {
        const targetInfo = allTargetThreads.get(target);
        targetInfo.wPid.forEach(pid => ns.kill(pid));
        await ns.sleep(10);
    }
}
