import type { NS } from 'netscript';

export async function main(ns: NS) {
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
