import type { NS } from "netscript";

import { MEM_TAG_FLAGS } from "services/client/memory_tag";

import { collectDependencies } from "util/dependencies";

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const host = ns.self().server;

    // We start the Discovery service first because everything else
    // needs the hosts and targets that it finds and cracks.
    await startDiscover(ns, host);
    await ns.sleep(500);

    await startMemory(ns, host);
    await startPort(ns, host);

    await startUpdater(ns, "n00dles");
}

async function startMemory(ns: NS, host: string) {
    const memoryScript = "/services/memory.js";

    const memory = ns.getRunningScript(memoryScript, host);
    if (memory !== null) {
        ns.kill(memory.pid);
    }

    manualLaunch(ns, memoryScript, host);
}

async function startDiscover(ns: NS, host: string) {
    const discoverScript = "/services/discover.js";

    const discover = ns.getRunningScript(discoverScript, host);
    if (discover !== null) {
        ns.kill(discover.pid);
    }

    manualLaunch(ns, discoverScript, host);
}

async function startUpdater(ns: NS, host: string) {
    const updaterScript = "/services/updater.js";

    const updater = ns.getRunningScript(updaterScript, host);
    if (updater !== null) {
        ns.kill(updater.pid);
    }

    manualLaunch(ns, updaterScript, host);
}

async function startPort(ns: NS, host: string) {
    const portScript = "/services/port.js";

    const portAllocator = ns.getRunningScript(portScript, host);
    if (portAllocator !== null) {
        ns.kill(portAllocator.pid);
    }

    manualLaunch(ns, portScript, host);
}

function manualLaunch(ns: NS, script: string, hostname: string) {
    const dependencies = collectDependencies(ns, script);
    const files = [script, ...dependencies];
    if (!ns.scp(files, hostname, "home")) {
        const error = `failed to send files to ${hostname}`;
        ns.toast(error, "error");
        ns.print(`ERROR: ${error}`);
        ns.ui.openTail();
        return;
    }

    const pid = ns.exec(script, hostname);
    if (pid === 0) {
        const error = `failed to launch ${script} on ${hostname}`;
        ns.toast(error, "error");
        ns.print(`ERROR: ${error}`);
        ns.ui.openTail();
        return;
    }
}
