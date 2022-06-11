/** @param {NS} ns */
export async function main(ns) {
  let host = ns.args[0];
  if (!ns.serverExists(host)) {
    ns.tprintf("%s does not exist.");
    ns.exit();
  }
  let analyzeScript = "analyze-server.js";

  if (!ns.fileExists(analyzeScript)) {
    ns.tprintf("analyze script %s does not exist", analyzeScript);
    ns.exit();
  }

  await ns.scp(analyzeScript, host);
  ns.run(analyzeScript);
}
