/** @param {NS} ns */
export async function main(ns) {
  for (const file in files) {
    await ns.wget(baseUrl + file, file, "home");
  }
}

const baseUrl = "https://raw.githubusercontent.com/RadicalZephyr/bitburner-scripts/latest/";

const files = [
  "algorithmic-trader-II.js",
  "analyze-server.js",
  "assign-gang.js",
  "best-target.js",
  "build-gang.js",
  "buy-hacknet.js",
  "check-hackable.js",
  "check-max-ram.js",
  "crack.js",
  "distribute-servers.js",
  "filter-node-list.js",
  "grow.js",
  "growth-security.js",
  "hack.js",
  "hack-the-world.js",
  "juiciest-target.js",
  "lib.js",
  "max-ram.js",
  "monitor.js",
  "new-hack.js",
  "number-sum-ways.js",
  "only-grow.js",
  "only-hack.js",
  "only-weaken.js",
  "purchase-servers.js",
  "retrieve-files.js",
  "run-analyze.js",
  "scan.js",
  "share.js",
  "startup.js",
  "stopworld.js",
  "test.js",
  "two-coloring.js",
  "upgrade-servers.js",
  "walk-network.js",
  "whereis.js"
];
