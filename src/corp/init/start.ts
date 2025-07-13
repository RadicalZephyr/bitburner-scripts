import type { NS } from "netscript";

import { CITIES, CORPORATION_NAME } from "corp/constants";

export async function main(ns: NS) {
    const corp = ns.corporation;
    const selfFund = false;

    if (!corp.hasCorporation()) {
        if (!corp.canCreateCorporation(selfFund)) {
            ns.tprint("not in a corporation!");
            return;
        }

        if (!corp.createCorporation(CORPORATION_NAME, selfFund)) {
            ns.tprint("could not create corporation, you may need to self-fund it!");
            return;
        }
    }
}
