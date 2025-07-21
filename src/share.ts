import type { NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    while (true) {
        await ns.share();
    }
}
