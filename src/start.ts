import type { NS } from "netscript";

import { LocalStorage } from "util/localStorage";

export async function main(ns: NS) {
    ns.disableLog("sleep");

    await waitForExit(ns, ns.exec("/get-all-hosts.js", "home"));
    ns.print("finished fetching all host info");

    // Sleep to let the game fully write out the all-hosts.js script
    setConfigDefaults();

    bootstrap(ns);
}

function setConfigDefaults() {
    setConfigDefault("BATCH_INTERVAL", 200);
}

function setConfigDefault(key, defaultValue) {
    if (!LocalStorage.getItem(key)) {
        LocalStorage.setItem(key, defaultValue);
    }
}

async function waitForExit(ns: NS, pid: number): Promise<void> {
    while (true) {
        await ns.sleep(100);
        if (!ns.isRunning(pid)) {
            break;
        }
    }
}

const BOOTSTRAP_FILES = [
    "/bootstrap.js",
    "/batch/client/memory.js"
];

function bootstrap(ns: NS) {
    let script = "/bootstrap.js";
    let files = [script, ...BOOTSTRAP_FILES];
    let hostname = "foodnstuff";

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
