import { MEM_TAG_FLAGS } from "services/client/memory_tag";
import { main as serviceBootstrap } from "services/bootstrap";
import { main as batchBootstrap } from "batch/bootstrap";
export async function main(ns) {
    const flags = ns.flags(MEM_TAG_FLAGS);
    await serviceBootstrap(ns);
    await batchBootstrap(ns);
}
function reportError(ns, error) {
    ns.toast(error, "error");
    ns.print(`ERROR: ${error}`);
    ns.ui.openTail();
}
const BOOTSTRAP_SCRIPTS = [
    "/services/bootstrap.js",
    "/batch/bootstrap.js"
];
export async function dynamicBootstrap(_ns) {
    let ns = _ns;
    let currentDynamicRam = ns.ramOverride();
    ;
    for (const script of BOOTSTRAP_SCRIPTS) {
        let scriptRam = ns.getScriptRam(script);
        currentDynamicRam = ns.ramOverride(Math.max(currentDynamicRam, scriptRam));
        let mod = await ns.dynamicImport(script);
        await mod.main(ns);
        await ns.sleep(10);
    }
}
