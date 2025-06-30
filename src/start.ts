import type { NS } from "netscript";

import { CONFIG } from "batch/config";

const BOOTSTRAP_FILES = [
    "/batch/bootstrap.js",
    "/services/launch.js",
    "/services/client/memory.js"
];

export async function main(ns: NS) {
    ns.disableLog("sleep");
    CONFIG.setDefaults();

    let script = "/batch/bootstrap.js";
    let files = [script, ...BOOTSTRAP_FILES];
    let hostname = "foodnstuff";

    if (!ns.scp(files, hostname, "home")) {
        let error = `failed to send files to ${hostname}`;
        ns.toast(error, "error");
        ns.print(`ERROR: ${error}`);
        ns.ui.openTail();
        return;
    }

    if (!ns.nuke(hostname)) {
        let error = `failed to nuke ${hostname}`;
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
