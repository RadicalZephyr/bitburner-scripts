import type { NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

import { main as serviceBootstrap } from "services/bootstrap";
import { main as batchBootstrap } from "batch/bootstrap";

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    await serviceBootstrap(ns);
    await batchBootstrap(ns);
}

interface DynImportNS extends NS {
    dynamicImport: (script: string) => Promise<ImportedScript>;
}

interface ImportedScript {
    main: (ns: NS) => Promise<void>;
}

const BOOTSTRAP_SCRIPTS = [
    "/services/bootstrap.js",
    "/batch/bootstrap.js"
];

export async function dynamicBootstrap(_ns: NS) {
    const ns = _ns as DynImportNS;

    let currentDynamicRam = ns.ramOverride();;

    for (const script of BOOTSTRAP_SCRIPTS) {
        const scriptRam = ns.getScriptRam(script);

        currentDynamicRam = ns.ramOverride(Math.max(currentDynamicRam, scriptRam));

        const mod = await ns.dynamicImport(script) as ImportedScript;
        await mod.main(ns);

        await ns.sleep(10);
    }
}
