import type { NS } from "netscript";

import { MEMORY_PORT, workerMessage } from "./batch/client/memory";

export async function main(ns: NS) {
    await waitForExit(ns, ns.exec("/get-all-hosts.js", "home"));
    ns.tprint("finished fetching all host info");

    // Sleep to let the game fully write out the all-hosts.js script
    await ns.sleep(1000);

    startCracker(ns);
    startBatchHcking(ns);

    sendPersonalServersToMemory(ns);
}

const CRACK_FILES: string[] = [
    "/all-hosts.js",
    "/util/ports.js",
    "/crack-all.js",

];

const MEMORY_FILES: string[] = [
    "/util/ports.js",
    "/batch/memory.js"
];

const MANAGE_FILES: string[] = [
    "/all-hosts.js",
    "/util/ports.js",
    "/batch/manage.js",
    "sanctuary-type-identifiers.js",
    "sanctuary-type-classes.js"
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

    ns.scp(CRACK_FILES, crackHost, "home");
    ns.exec(crackScript, crackHost);
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

    ns.scp(memoryFiles, memoryHost, "home");
    ns.exec(memoryScript, memoryHost);

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

    ns.scp(manageFiles, manageHost, "home");
    ns.exec(manageScript, manageHost);
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
    let memPort = ns.getPortHandle(MEMORY_PORT);
    let personalServers = ns.getPurchasedServers();

    await ns.sleep(500);

    for (const hostname of personalServers) {
        memPort.write(workerMessage(hostname));
    }
}
