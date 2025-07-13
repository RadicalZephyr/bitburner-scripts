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

        for (let i = 0; i < 4; i++)
            corp.hireEmployee(AGRI_DIVISION, city, "Research & Development");
        ns.tprint(`hired 4 employees for R&D at ${AGRI_DIVISION} in ${city}`);
    }
}
