import type { NS } from "netscript";

import { CONFIG } from "batch/config";

export async function main(ns: NS) {
    ns.disableLog("sleep");
    CONFIG.setDefaults();

    bootstrap(ns);
}

const BOOTSTRAP_FILES = [
    "/all-hosts.js",
    "/bootstrap.js",
    "/batch/launch.js",
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
