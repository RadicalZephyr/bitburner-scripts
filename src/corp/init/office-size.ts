import type { NS } from "netscript";

import { AGRI_DIVISION, CITIES, CORPORATION_NAME } from "corp/constants";

export async function main(ns: NS) {
    const corp = ns.corporation;

    if (!corp.hasCorporation()) {
        ns.tprint("you must start a corporation first!");
        return;
    }

    const agriDiv = corp.getDivision(AGRI_DIVISION);
    const agriDivCities = new Set(agriDiv.cities);
    for (const city of CITIES) {
        if (!agriDivCities.has(city)) continue;

        corp.upgradeOfficeSize(AGRI_DIVISION, city, 1);
        ns.tprint(`expanded office size in ${city}`);
    }

    ns.tprint("now run corp/init/warehouse.js");
}
