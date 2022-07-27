import type { NS } from "netscript";

export async function main(ns: NS) {
    while (true) {
        await ns.share();
    }
}
