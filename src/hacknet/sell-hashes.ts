import type { NS } from "netscript";

export async function main(ns: NS) {
    const flags = ns.flags([
        ["help", false],
    ]);

    const hashCapacity = ns.hacknet.hashCapacity();
    if (flags.help || hashCapacity === 0) {
        ns.tprint(`
Usage: run ${ns.getScriptName()} [--help]

Sell all the hashes for cash. Only works with Hacknet Servers not nodes.

OPTIONS
  --help         Display this message
`);
        return;

    }

    const currentHashes = ns.hacknet.numHashes();

    const cost = ns.hacknet.hashCost("Sell for Money");

    const numToSell = Math.floor(currentHashes / cost);

    ns.hacknet.spendHashes("Sell for Money", "", numToSell);

    const value = numToSell * 1000000;
    ns.tprint(`sold ${numToSell * cost} hashes for $${ns.formatNumber(value)}`);

}
