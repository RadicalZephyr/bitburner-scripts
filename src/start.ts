import type { NS } from "netscript";

export async function main(ns: NS) {
    await waitForExit(ns, ns.exec("/get-all-hosts.js", "home"));
    ns.tprint("finished fetching all host info");

    // Sleep to let the game fully write out the all-hosts.js script
    await ns.sleep(1000);

    startCracker(ns);
}

const CRACK_FILES: string[] = [
    "/all-hosts.js",
    "/util/ports.js",
    "/crack-all.js",
    "/batch/manage.js"
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
    const manageHost = "foodnstuff";
    const manageScript = "/batch/manage.js";
    let manager = ns.getRunningScript(manageScript, manageHost);
    if (manager !== null) {
        ns.kill(manager.pid);
    } else {
        ns.nuke(manageHost);
    }

    ns.scp(CRACK_FILES, crackHost, "home");
    ns.exec(crackScript, crackHost);
    ns.scp(CRACK_FILES, manageHost, "home");
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
