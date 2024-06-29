import type { NS } from "netscript";

import { TILL_PORT } from 'util/ports';

export async function main(ns: NS) {
    let tillPort = ns.getPortHandle(TILL_PORT);

    // When should these scripts quit?
    while (true) {
        let currentLevel = ns.getHackingLevel();
        await ns.sleep(100);

    }
}
