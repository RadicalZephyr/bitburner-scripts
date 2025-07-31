import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    const sing = ns.singularity;

    if (ns.getServerMoneyAvailable('home') < 200_000) return;

    if (!sing.purchaseTor()) return;

    if (ns.getServerMoneyAvailable('home') < 200_000) return;

    const volhaven = ns.enums.CityName.Volhaven;
    if (!sing.travelToCity(volhaven)) return;

    const zbU = ns.enums.LocationName.VolhavenZBInstituteOfTechnology;
    const algClass = ns.enums.UniversityClassType.algorithms;
    sing.universityCourse(zbU, algClass);
}
