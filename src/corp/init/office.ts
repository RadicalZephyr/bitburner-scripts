import type { NS } from "netscript";

import { AGRI_DIVISION, CITIES } from "corp/constants";

export async function main(ns: NS) {
    const corp = ns.corporation;

    if (!corp.hasCorporation()) {
        ns.tprint("you must start a corporation first!");
        return;
    }

    const agriDiv = corp.getDivision(AGRI_DIVISION);
    const agriDivCities = new Set(agriDiv.cities);
    for (const city of CITIES) {
        if (agriDivCities.has(city)) continue;

        corp.expandCity(AGRI_DIVISION, city);
        ns.tprint(`expanded ${AGRI_DIVISION} into ${city}`);
    }
    ns.tprint("now run corp/init/office-size.js");
}
