import type { NS, Office } from "netscript";

import { AGRI_DIVISION, CITIES, CORPORATION_NAME } from "corp/constants";

export async function main(ns: NS) {
    const corp = ns.corporation;

    if (!corp.hasCorporation()) {
        ns.tprint("you must start a corporation first!");
        return;
    }

    const agriDiv = corp.getDivision(AGRI_DIVISION);

    for (const city of agriDiv.cities) {
        const office = corp.getOffice(AGRI_DIVISION, city);
        manageOfficeHappiness(ns, office);
    }

    await corp.nextUpdate();
    while (true) {
        await corp.nextUpdate();
    }
}

async function manageOfficeHappiness(ns: NS, office: Office) {
    let running = true;
    ns.atExit(() => {
        running = false;
    }, `manageOfficeHappiness-${office.city}`);

    const corp = ns.corporation;
    while (running) {
        ns.tprint(`managing ${AGRI_DIVISION} office in ${office.city}`);
        await corp.nextUpdate();
    }
}
