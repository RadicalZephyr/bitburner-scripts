import type { NS } from "netscript";

import { MemoryClient } from "services/client/memory";

export async function main(ns: NS) {
    const host = ns.self().server;

    // We start the Discovery service first because everything else
    // needs the hosts and targets that it finds and cracks.
    await startDiscover(ns, host);
    await ns.sleep(500);

    await startMemory(ns, host);
}

const MEMORY_FILES: string[] = [
    "/services/client/discover.js",
    "/services/client/memory.js",
    "/util/client.js",
    "/util/config.js",
    "/util/localStorage.js",
    "/util/ports.js"
];

async function startMemory(ns: NS, host: string) {
    const memoryScript = "/services/memory.js";

    const memory = ns.getRunningScript(memoryScript, host);
    if (memory !== null) {
        ns.kill(memory.pid);
    }

    manualLaunch(ns, memoryScript, host, MEMORY_FILES);
}

const DISCOVER_FILES = [
    "/services/client/discover.js",
    "/util/client.js",
    "/util/ports.js",
    "/util/walk.js"
];

async function startDiscover(ns: NS, host: string) {
    const discoverScript = "/services/discover.js";

    const discover = ns.getRunningScript(discoverScript, host);
    if (discover !== null) {
        ns.kill(discover.pid);
    }

    manualLaunch(ns, discoverScript, host, DISCOVER_FILES);
}



function manualLaunch(ns: NS, script: string, hostname: string, dependencies: string[]) {
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
