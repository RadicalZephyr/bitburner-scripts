const BOOTSTRAP_SCRIPTS = [
    "/services/bootstrap.js",
    "/batch/bootstrap.js"
];
export async function main(ns) {
    for (const script of BOOTSTRAP_SCRIPTS) {
        let pid = ns.run(script);
        if (pid === 0) {
            reportError(ns, `failed to launch ${script}`);
        }
    }
}
function reportError(ns, error) {
    ns.toast(error, "error");
    ns.print(`ERROR: ${error}`);
    ns.ui.openTail();
}
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
