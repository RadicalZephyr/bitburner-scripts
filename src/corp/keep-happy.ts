import type { NS, AutocompleteData, CityName } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { withPlugins } from 'ns/extend';
import { alivePlugin } from 'ns/plugins/alive';
import { CONFIG } from './config';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

function extendNs(ns: NS) {
    return withPlugins(ns, alivePlugin());
}

type NSX = ReturnType<typeof extendNs>;

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Keep all offices in all divisions running smoothly and efficiently by maximizing
employee stamina and happiness with excessive amounts of tea and parties.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await manageOffices(extendNs(ns));
}

async function manageOffices(ns: NSX) {
    if (!ns.corporation.hasCorporation()) {
        ns.tprint('you must start a corporation first!');
        return;
    }

    const corp = ns.corporation.getCorporation();

    for (const divisionName of corp.divisions) {
        const division = ns.corporation.getDivision(divisionName);

        for (const city of division.cities) {
            void manageOfficeHappiness(ns, divisionName, city);
        }
    }

    return await ns.alive.untilKilled();
}

async function manageOfficeHappiness(
    ns: NSX,
    division: string,
    city: CityName,
) {
    ns.print(`managing ${division} office in ${city}`);

    while (ns.alive.isAlive()) {
        const phase = await ns.corporation.nextUpdate();
        if (phase !== 'SALE') continue;

        const office = ns.corporation.getOffice(division, city);

        const energyPct = office.avgEnergy / office.maxEnergy;
        if (energyPct < CONFIG.lowEnergyThreshold) {
            ns.corporation.buyTea(division, city);
        }

        const moralePct = office.avgMorale / office.maxMorale;
        if (moralePct < CONFIG.lowMoraleThreshold) {
            // TODO: Choose how much money to spend on party based on needed morale increase
            const budget = 1e6;
            ns.corporation.throwParty(division, city, budget);
        }
    }
}
