import type { NS } from "netscript";

import { MemoryClient } from "./batch/client/memory";

export async function main(ns: NS) {
    ns.disableLog("sleep");

    await waitForExit(ns, ns.exec("/get-all-hosts.js", "home"));
    ns.print("finished fetching all host info");

    // Sleep to let the game fully write out the all-hosts.js script
    await ns.sleep(1000);

    startBatchHcking(ns);
    await ns.sleep(1000);

    await sendPersonalServersToMemory(ns);
    await ns.sleep(1000);

    startCracker(ns);
}

const CRACK_FILES: string[] = [
    "/crack-all.js",
    "/all-hosts.js",
    "/batch/client/manage.js",
    "/batch/client/memory.js",
    "/util/ports.js"
];

const MEMORY_FILES: string[] = [
    "/util/ports.js",
    "/batch/memory.js"
];

const MANAGE_FILES: string[] = [
    "/batch/client/manage.js",
    "/batch/target.js",
    "/util/ports.js",
];

function startCracker(ns: NS) {
    const crackHost = "n00dles";
    const crackScript = "/crack-all.js";
    let cracker = ns.getRunningScript(crackScript, crackHost);
    if (cracker !== null) {
        // TODO: Should we check if the kill succeeded?
        ns.kill(cracker.pid);
    } else {
        ns.nuke(crackHost);
    }

    launch(ns, crackScript, crackHost, CRACK_FILES);
}

function startBatchHcking(ns: NS) {
    const memoryHost = "foodnstuff";
    const memoryScript = "/batch/memory.js";
    let memory = ns.getRunningScript(memoryScript, memoryHost);
    if (memory !== null) {
        ns.kill(memory.pid);
    } else {
        ns.nuke(memoryHost);
    }

    let batchFiles = ns.ls("home", "batch");
    let memoryFiles = [...MEMORY_FILES, ...batchFiles];

    launch(ns, memoryScript, memoryHost, memoryFiles);

    const manageHost = "foodnstuff";
    const manageScript = "/batch/manage.js";
    let manager = ns.getRunningScript(manageScript, manageHost);
    if (manager !== null) {
        ns.kill(manager.pid);
    } else {
        ns.nuke(manageHost);
    }

    let collectionsFiles = ns.ls("home", "typescript-collections");
    let manageFiles = [...MANAGE_FILES, ...batchFiles, ...collectionsFiles];

    launch(ns, manageScript, manageHost, manageFiles);
}

async function waitForExit(ns: NS, pid: number): Promise<void> {
    while (true) {
        await ns.sleep(100);
        if (ns.getRunningScript(pid) === null) {
            break;
        }
    }
}

async function sendPersonalServersToMemory(ns: NS) {
    let memoryClient = new MemoryClient(ns);
    let personalServers = ns.getPurchasedServers();

    for (const hostname of personalServers) {
        await memoryClient.newWorker(hostname);
    }
}

function launch(ns: NS, script: string, hostname: string, dependencies: string[]) {
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
