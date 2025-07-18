import type { NS } from "netscript";

import { MemoryClient } from "services/client/memory";

import { collectDependencies } from "util/dependencies";

export async function main(ns: NS) {
    const host = ns.self().server;

    // We start the Discovery service first because everything else
    // needs the hosts and targets that it finds and cracks.
    await startDiscover(ns, host);
    await ns.sleep(500);

    await startMemory(ns, host);
    await startUpdater(ns, host);
    await startPort(ns, host);
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
    let dependencies = collectDependencies(ns, script);
    let files = [script, ...dependencies];
    if (!ns.scp(files, hostname, "home")) {
        let error = `failed to send files to ${hostname}`;
        ns.toast(error, "error");
        ns.print(`ERROR: ${error}`);
        ns.ui.openTail();
        return;
    }

    let pid = ns.run(script);
    if (pid === 0) {
        let error = `failed to launch ${script} on ${hostname}`;
        ns.toast(error, "error");
        ns.print(`ERROR: ${error}`);
        ns.ui.openTail();
        return;
    }
}
