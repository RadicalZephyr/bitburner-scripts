import type { NS } from "netscript";

import { MemoryClient } from "/batch/client/memory";

export async function main(ns: NS) {
    let client = new MemoryClient(ns);
    let response = await client.requestAllocation(1, 1);
    ns.tprintf("got allocation response: %s", JSON.stringify(response));

}
