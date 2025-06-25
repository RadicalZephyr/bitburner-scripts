import type { NS } from "netscript";

import { MemoryClient } from "batch/client/memory";

export async function main(ns: NS) {
    startBatchHcking(ns);
    await sendPersonalServersToMemory(ns);
    startCracker(ns);
    startMonitor(ns);
}

async function sendPersonalServersToMemory(ns: NS) {
    let memoryClient = new MemoryClient(ns);
    let personalServers = ns.getPurchasedServers();

    for (const hostname of personalServers) {
        await memoryClient.newWorker(hostname);
    }
}

const MEMORY_FILES: string[] = [
    "/batch/client/memory.js",
    "/util/ports.js"
];

const MANAGE_FILES: string[] = [
    "/batch/client/manage.js",
    "/batch/config.js",
    "/batch/launch.js",
    "/batch/target.js",
    "/util/localStorage.js",
    "/util/ports.js",
];

function startBatchHcking(ns: NS) {
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

const CRACK_FILES: string[] = [
    "/crack-all.js",
    "/all-hosts.js",
    "/batch/client/manage.js",
    "/batch/client/memory.js",
    "/util/ports.js"
];

function startCracker(ns: NS) {
    const crackHost = "sigma-cosmetics";
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

const MONITOR_FILES: string[] = [
    "/all-hosts.js",
    "/batch/client/monitor.js",
    "/batch/expected_value.js",
    "/util/ports.js",
];

function startMonitor(ns: NS) {
    const monitorHost = "foodnstuff";
    const monitorScript = "/batch/monitor.js";

    let monitor = ns.getRunningScript(monitorScript, monitorHost);
    if (monitor !== null) {
        ns.kill(monitor.pid);
    } else {
        ns.nuke(monitorHost);
    }

    let hostname = monitorHost;
    let script = monitorScript;
    let dependencies = MONITOR_FILES;
    let files = [script, ...dependencies];
    if (!ns.scp(files, hostname, "home")) {
        let error = `failed to send files to ${hostname}`;
        ns.toast(error, "error");
        ns.print(`ERROR: ${error}`);
        ns.ui.openTail();
        return;
    }

    ns.spawn(script);
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
