import type { NS } from "netscript";

import { CONFIG } from "batch/config";

import { collectDependencies } from "util/dependencies";

export async function main(ns: NS) {
    ns.disableLog("sleep");

    let script = "/bootstrap.js";
    let dependencies = collectDependencies(ns, script);
    let files = [script, ...dependencies];
    let hostname = "foodnstuff";

    if (!ns.scp(files, hostname, "home")) {
        reportError(ns, `failed to send files to ${hostname}`);
        return;
    }

    if (!ns.nuke(hostname)) {
        reportError(ns, `failed to nuke ${hostname}`);
        return;
    }

    let pid = ns.exec(script, hostname);
    if (pid === 0) {
        reportError(ns, `failed to launch ${script} on ${hostname}`);
        return;
    }
}

function reportError(ns: NS, error: string) {
    ns.toast(error, "error");
    ns.print(`ERROR: ${error}`);
    ns.ui.openTail();
}
