import type { NS, Office } from 'netscript';

export async function main(ns: NS) {
    const corpNS = ns.corporation;

    if (!corpNS.hasCorporation()) {
        ns.tprint('you must start a corporation first!');
        return;
    }

    const corp = corpNS.getCorporation();

    for (const div of corp.divisions) {
        const agriDiv = corpNS.getDivision(div);

        for (const city of agriDiv.cities) {
            const office = corpNS.getOffice(div, city);
            manageOfficeHappiness(ns, div, office);
        }
    }

    await corpNS.nextUpdate();
    while (true) {
        await corpNS.nextUpdate();
    }
}

async function manageOfficeHappiness(ns: NS, division: string, office: Office) {
    let running = true;
    ns.atExit(() => {
        running = false;
    }, `manageOfficeHappiness-${office.city}`);

    const corp = ns.corporation;
    while (running) {
        ns.tprint(`managing ${division} office in ${office.city}`);
        await corp.nextUpdate();
    }
}
