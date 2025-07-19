import { ALLOC_ID, MEM_TAG_FLAGS } from "services/client/memory_tag";
import { parseAndRegisterAlloc } from "services/client/memory";
import { CONFIG } from "./config";
export async function main(ns) {
    const flags = ns.flags([
        ["continue", false],
        ["help", false],
        ...MEM_TAG_FLAGS
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
    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
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
