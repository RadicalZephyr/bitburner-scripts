import { walkNetworkBFS } from 'walk-network';

/** @param {NS} ns */
export async function main(ns) {
  const networkGraph = walkNetworkBFS(ns);
  for (const host of networkGraph.keys()) {
    ns.killall(host, true);
  }
}
