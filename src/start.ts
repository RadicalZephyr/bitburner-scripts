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
    "/crack-all.js"
];

function startCracker(ns: NS) {
    let host = "n00dles";
    let script = "/crack-all.js";
    let crackScript = ns.getRunningScript(script, host);
    if (crackScript !== null) {
        // TODO: Should we check if the kill succeeded?
        ns.kill(crackScript.pid);
    }

    ns.scp(CRACK_FILES, host, "home");
    ns.exec(script, host);
}

async function waitForExit(ns: NS, pid: number): Promise<void> {
    while (true) {
        await ns.sleep(100);
        if (ns.getRunningScript(pid) === null) {
            break;
        }
    }
}
