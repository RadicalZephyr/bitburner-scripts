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

    const happyDivisions: Map<string, Set<CityName>> = new Map();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of ns.alive.loop(100)) {
        const corp = ns.corporation.getCorporation();

        for (const divisionName of corp.divisions) {
            const division = ns.corporation.getDivision(divisionName);

            let happyCities: Set<CityName> | undefined =
                happyDivisions.get(divisionName);
            if (!happyCities) {
                happyCities = new Set();
                happyDivisions.set(divisionName, happyCities);
            }

            for (const city of division.cities) {
                if (happyCities.has(city)) continue;

                void manageOfficeHappiness(ns, divisionName, city);
                happyCities.add(city);
            }
        }
    }
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
            const budget = budgetForParty(office.avgMorale, office.maxMorale);
            ns.corporation.throwParty(division, city, budget);
        }
    }
}

/**
 * Calculate the budget to use to get the percent increase we need.
 *
 * @remarks
 *
 * Game Code References:
 *
 * - src/Corporation/Actions.ts#410 - `throwParty` function
 * - src/Corporation/OfficeSpace.ts#101 - `process` function
 *
 * Party morale increase is a multiplier to the current average morale
 * calculated like so:
 *
 * `1 + (costPerEmployee / 10e6)`
 *
 * A constant amount is added before the multiplier as well, calculated like so:
 *
 * `(partyMult - 1) * 10`
 *
 * So the new morale is calculate like so (simplified):
 *
 * ```ts
 * const partyMult = 1 + costPerEmployee / 10e6;
 * const increase = (partyMult - 1) * 10;
 * avgMorale = (avgMorale + increase) * partyMult;
 * ```
 *
 * Let's rewrite this as mathematical equations using the following symbols:
 *
 * `B`: per-employee party budget (cost per employee)
 * `C`: current average morale
 * `T`: target average morale (i.e. max morale)
 *
 * And some intermediate values to match how the game calculates things:
 *
 * `M`: morale multiplier from throwing a party (`partyMult` in the code)
 * `F`: flat morale increase from throwing a party (`increase` in the code)
 *
 * `M = 1 + B/10^7`
 * `F = (M - 1) * 10`
 * `T = (C + F) * M`
 *
 * Let's simplify a little bit by substituting `M` in the equation for `F`.
 * `F = (1 + B/10^7 - 1) * 10`
 * `F = (B/10^7) * 10`
 * `F = B/10^6`
 *
 * Let's introduce a new value to simplify our budget value.
 *
 * `x = B / 10^6`
 *
 * Now we have:
 *
 * `M = 1 + x/10`
 * `F = x`
 * `T = (C + F) * M`
 *
 * Substituting into `T`:
 *
 * `T = (C + x) * (1 + x/10)`
 *
 * Expanding and simplifying we get:
 *
 * `T = (1/10)x^2 + (1 + C/10)x + C`
 * `0 = (1/10)x^2 + (1 + C/10)x + C - T`
 *
 * Solving for `x` with the quadratic equation we get:
 * https://www.wolframalpha.com/input?i=solve+%281%2F10%29x%5E2+%2B+%281+%2B+%28c+%2F+10%29%29x+%2B+%28c+-+t%29+%3D+0
 *
 * `x = 1/2 * (sqrt(C^2 - 20C + 40T + 100) - C - 10)`
 * `B = (10^6)/2 * (sqrt(C^2 - 20C + 40T + 100) - C - 10)`
 * `B = 5 * 10^5 * (sqrt(C^2 - 20C + 40T + 100) - C - 10)`
 */
function budgetForParty(avgMorale: number, maxMorale: number): number {
    const C = avgMorale;
    const T = maxMorale;

    return 5e5 * (Math.sqrt(C ** 2 - 20 * C + 40 * T + 100) - C - 10);
}
