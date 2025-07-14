import type { NS } from "netscript";
import { CONFIG } from "./config";

export async function main(ns: NS) {
    const flags = ns.flags([
        ["continue", false],
        ["help", false],
    ]);

    const hashCapacity = ns.hacknet.hashCapacity();
    if (flags.help || typeof flags.continue !== 'boolean' || hashCapacity === 0) {
        ns.tprint(`
Usage: run ${ns.getScriptName()} [--help]

Sell all the hashes for cash. Only works with Hacknet Servers not nodes.

OPTIONS
  --continue  Continue to sell hashes perpetually
  --help      Display this message
`);
        return;

    }

    do {
        if (flags.continue)
            await ns.sleep(CONFIG.sellSleepTime);

        const currentHashes = ns.hacknet.numHashes();

        const cost = ns.hacknet.hashCost("Sell for Money");

        const numToSell = Math.floor(currentHashes / cost);

        ns.hacknet.spendHashes("Sell for Money", "", numToSell);

        const value = numToSell * 1000000;
        ns.print(`sold ${numToSell * cost} hashes for $${ns.formatNumber(value)}`);
    } while (flags.continue);
}
