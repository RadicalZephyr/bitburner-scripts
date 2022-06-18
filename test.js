/** @param {NS} ns */
export async function main(ns) {
    let player = ns.getPlayer();
    let hackPercent = ns.formulas.hacking.hackPercent(ns.getServer("n00dles"), player);
    let hackAnalyze = ns.hackAnalyze("n00dles");
    ns.tprintf("hack percent of n00dles %s, hackAnalyze %s", hackPercent, hackAnalyze);
    let sourceFiles = ns.getOwnedSourceFiles().map(sf => "n: " + sf.n + " lvl: " + sf.lvl);
    ns.tprintf("owned source files %s []", sourceFiles.length, sourceFiles.join(","));
}
