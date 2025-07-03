import type { NS } from "netscript";

import { MemoryClient } from "services/client/memory";
import { launch } from "services/launch";

export async function main(ns: NS) {
    await startMemory(ns);

    await ns.sleep(500);
    await startDiscover(ns);
}

const MEMORY_FILES: string[] = [
    "/services/client/memory.js",
    "/util/client.js",
    "/util/ports.js"
];

const BASIC_WORKERS = [
    "n00dles",
    "foodnstuff",
    "sigma-cosmetics",
    "joesguns",
    "hong-fang-tea",
    "harakiri-sushi",
    "nectar-net"
];

async function startMemory(ns: NS) {
    const memoryHost = "n00dles";
    const memoryScript = "/services/memory.js";
    let memory = ns.getRunningScript(memoryScript, memoryHost);
    if (memory !== null) {
        ns.kill(memory.pid);
    } else {
        ns.nuke(memoryHost);
    }

    ns.nuke(memoryHost);
    manualLaunch(ns, memoryScript, memoryHost, MEMORY_FILES);

    await ns.sleep(1000);

    // Send the Memory daemon some bootstrapping clients
    let memClient = new MemoryClient(ns);

    await memClient.newWorker("home");

    let personalServers = ns.getPurchasedServers();

    for (const hostname of personalServers) {
        await memClient.newWorker(hostname);
    }

    // All of these hosts require zero open ports to nuke
    for (const worker of BASIC_WORKERS) {
        ns.nuke(worker);
        await memClient.newWorker(worker);
    }
}

async function startDiscover(ns: NS) {
    const discoverScript = "/services/discover.js";

    await launch(ns, discoverScript, {
        threads: 1, allocationFlag: "--allocation-id"
    });
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

    let pid = ns.exec(script, hostname);
    if (pid === 0) {
        let error = `failed to launch ${script} on ${hostname}`;
        ns.toast(error, "error");
        ns.print(`ERROR: ${error}`);
        ns.ui.openTail();
        return;
    }
}
