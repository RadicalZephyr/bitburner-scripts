import { numThreads, validTarget } from 'lib.js';

let servers0Port = [
  "foodnstuff",
  "sigma-cosmetics",
  "joesguns",
  "nectar-net",
  "hong-fang-tea",
  "harakiri-sushi"
];

let servers1Port = [
  "neo-net",
  "zer0",
  "max-hardware",
  "iron-gym",
  "CSEC",
];

let servers2Port = [
  "avmnite-02h",
  "omega-net",
  "phantasy",
  "silver-helix"
];

let serverLists = [servers0Port, servers1Port, servers2Port];

/** @param {NS} ns */
export async function main(ns) {
  let target = ns.args[0];
  if (!validTarget(ns, target)) {
    target = await ns.prompt("choose a target server", serverPromptOptions());
    if (!validTarget(ns, target)) {
      ns.tprint("invalid target selected");
      ns.exit();
    }
  }

  let hackScript = "grow.js";

  let purchasedServers = ns.getPurchasedServers();
  await startNodes(ns, purchasedServers, target, hackScript, -1);

  for (let i = 0; i < serverLists.length; ++i) {
    let servers = serverLists[i];
    await startNodes(ns, servers, target, hackScript, i);
  }
}

function serverPromptOptions() {
  let serverOptions = [];

  for (let i = 0; i < serverLists.length; ++i) {
    serverOptions.push(...serverLists[i]);
  }

  return {
    "type": "select",
    "choices": serverOptions
  };
}

/**
 *
 * @param {NS} ns
 * @param {string[]} nodes
 * @param {string} target
 * @param {string} hackScript
 * @param {number} hackScriptRam
 * @param {number} level
 */
async function startNodes(ns, nodes, target, hackScript, level) {
  let hackScriptRam = ns.getScriptRam(hackScript);

  for (let i = 0; i < nodes.length; ++i) {
    let node = nodes[i];
    let threads = numThreads(ns, node, hackScriptRam);

    if (threads === 0) {
      continue;
    }

    if (await hackServer(ns, node, level)) {
      await ns.scp(hackScript, node);
      ns.exec(hackScript, node, threads, target);
    }
  }
}

/** Hack server if necessary.
 *
 * @param {NS} ns
 * @param {string} node
 * @param {number} level
 */
async function hackServer(ns, node, level) {
  if (!ns.hasRootAccess(node) && ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(node)) {
    if (level >= 1) {
      while (!ns.fileExists("BruteSSH.exe")) {
        await ns.sleep(1000 * 60);
      }
      ns.brutessh(node);
    }
    if (level >= 2) {
      while (!ns.fileExists("FTPCrack.exe")) {
        await ns.sleep(1000 * 60);
      }
      ns.ftpcrack(node);
    }
    if (level >= 0) {
      ns.nuke(node);
    }
  }
  return ns.hasRootAccess(node);
}
