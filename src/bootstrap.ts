import type { NS } from "netscript";

const BOOTSTRAP_SCRIPTS = [
    "/services/bootstrap.js",
    "/batch/bootstrap.js"
];

interface DynImportNS extends NS {
    dynamicImport: (script: string) => Promise<any>;
}

interface ImportedScript {
    main: (ns: NS) => Promise<void>;
}

export async function main(ns: NS) {
    for (const script of BOOTSTRAP_SCRIPTS) {
        let pid = ns.run(script);
        if (pid === 0) {
            reportError(ns, `failed to launch ${script}`);
        }
    }
}

function reportError(ns: NS, error: string) {
    ns.toast(error, "error");
    ns.print(`ERROR: ${error}`);
    ns.ui.openTail();
}

export async function dynamicBootstrap(_ns: NS) {
    let ns = _ns as DynImportNS;

    let currentDynamicRam = ns.ramOverride();;

    for (const script of BOOTSTRAP_SCRIPTS) {
        let scriptRam = ns.getScriptRam(script);

        currentDynamicRam = ns.ramOverride(Math.max(currentDynamicRam, scriptRam));

        let mod = await ns.dynamicImport(script) as ImportedScript;
        await mod.main(ns);

        await ns.sleep(10);
    }
}
