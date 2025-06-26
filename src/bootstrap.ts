import type { NS } from "netscript";

import { HOSTS_BY_PORTS_REQUIRED } from "./all-hosts";

import { MemoryClient } from "batch/client/memory";
import { launch } from "batch/launch";


export async function main(ns: NS) {
    await startMemory(ns);
    await startManager(ns);
    await startCracker(ns);
    await startMonitor(ns);
    await sendPersonalServersToMemory(ns);
}

const MEMORY_FILES: string[] = [
    "/batch/client/memory.js",
    "/util/ports.js"
];

async function startMemory(ns: NS) {
    const memoryHost = "n00dles";
    const memoryScript = "/batch/memory.js";
    let memory = ns.getRunningScript(memoryScript, memoryHost);
    if (memory !== null) {
        ns.kill(memory.pid);
    } else {
        ns.nuke(memoryHost);
    }

    let batchFiles = ns.ls("home", "batch");
    let memoryFiles = [...MEMORY_FILES, ...batchFiles];

    manualLaunch(ns, memoryScript, memoryHost, memoryFiles);

    await ns.sleep(1000);

    let memClient = new MemoryClient(ns);

    for (const worker of HOSTS_BY_PORTS_REQUIRED[0]) {
        ns.nuke(worker);
        await memClient.newWorker(worker);
    }
}

async function startManager(ns: NS) {
    const manageScript = "/batch/manage.js";

    launch(ns, manageScript, {
        threads: 1, allocationFlag: "--allocation-id"
    });
}

async function startCracker(ns: NS) {
    const crackScript = "/crack-all.js";

    await launch(ns, crackScript, {
        threads: 1, allocationFlag: "--allocation-id"
    });
}

async function startMonitor(ns: NS) {
    const monitorScript = "/batch/monitor.js";

    await launch(ns, monitorScript, {
        threads: 1, allocationFlag: "--allocation-id"
    });
}

async function sendPersonalServersToMemory(ns: NS) {
    let memoryClient = new MemoryClient(ns);
    let personalServers = ns.getPurchasedServers();

    for (const hostname of personalServers) {
        await memoryClient.newWorker(hostname);
    }
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
