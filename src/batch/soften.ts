import type { NS } from "netscript";

import { SOFTEN_PORT } from 'util/ports';

export async function main(ns: NS) {
    let softenPort = ns.getPortHandle(SOFTEN_PORT);

    // When should these scripts quit?
    while (true) {
        let currentLevel = ns.getHackingLevel();

    }
}
