import { walkNetworkBFS } from "./walk-network.js";

export function autocomplete(data, args) {
  return data.servers;
}

/** @param {NS} ns */
export async function main(ns) {
  const flags = ns.flags([
    ['startingHost', 'home'],
    ['help', false],
  ]);
  if (flags._.length === 0 || flags.help) {
    ns.tprint("This script prints the path between two servers in the network.");
    ns.tprint(`USAGE: run ${ns.getScriptName()} SERVER_NAME`);
    ns.tprint("Example:");
    ns.tprint(`> run ${ns.getScriptName()} n00dles`);
    return;
  }

  if (!ns.serverExists(flags.startingHost)) {
    ns.tprintf("start host %s does not exist", flags.startingHost);
    ns.exit();
  }

  let goalHost = ns.args[0];
  if (!ns.serverExists(goalHost)) {
    ns.tprintf("goal host %s does not exist", goalHost);
    ns.exit();
  }

  let network = walkNetworkBFS(ns);
  let allHosts = new Set(network.keys());
  if (!allHosts.has(goalHost)) {
    ns.tprint("Did not find goal host %s during network scan");
    ns.exit();
  }

  let shortestPaths = dijkstra(ns, network, flags.startingHost);

  let S = [];
  let u = goalHost;

  if (shortestPaths.get(u) !== null) {
    while (u !== null) {
      S.push(u);
      u = shortestPaths.get(u);
      await ns.sleep(1);
    }
  }
  ns.tprintf("path to %s:\n%s", goalHost, S.reverse().join(" ; go "));
}

/**
 *
 * @param {NS} ns
 * @param {Map<string, string[]>} network
 * @param {string} source
 */
export function dijkstra(ns, network, source) {
  let Q = new Set();
  let dist = new Map();
  let prev = new Map();
  //ns.tprintf("prev: %s", prev);
  for (const v of network.keys()) {
    dist.set(v, +Infinity);
    prev.set(v, null);
    Q.add(v);
  }
  dist.set(source, 0);
  //ns.tprintf("Q.keys() = %s", Array.from(Q.keys()));
  while (Array.from(Q.keys()).length > 0) {
    let u = min_distance(ns, dist, Q);
    Q.delete(u);
    //ns.tprintf("u: %s", u);
    let neighbours = network.get(u);
    let unvisitedNeighbours = neighbours.filter(v => Q.has(v));
    for (const v of unvisitedNeighbours) {
      let alt = dist.get(u) + 1;
      if (alt < dist.get(v) && dist.get(u) != Infinity) {
        dist.set(v, alt);
        prev.set(v, u);
      }
    }
  }

  return prev;
}

/**
 *
 * @param {Map<string, number} dist
 * @param {Set<string>} unvisited
 */
function min_distance(ns, dist, unvisited) {
  let least = Infinity;
  let leastV = null;
  //ns.tprintf("unvisted keys: %s", Array.from(unvisited.keys()));
  for (const v of unvisited.keys()) {
    //ns.tprintf("checking %s for least distance: %s", v, dist.get(v));
    if (dist.get(v) < least) {
      least = dist.get(v);
      //ns.tprintf("found a new smallest value: %s", least);
      leastV = v;
    }
  }
  return leastV;
}
