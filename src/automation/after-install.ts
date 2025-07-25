import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);

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
