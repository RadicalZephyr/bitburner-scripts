import type { FactionName, NS } from 'netscript';

/**
 * Get the complete list of factions available in the game.
 *
 * @param ns - Netscript API
 * @returns Array of all faction names
 */
export function allFactions(ns: NS): FactionName[] {
    return [
        ...locationFactions(ns),
        ...hackingFactions(ns),
        ...crimeFactions(ns),
        ...companyFactions(ns),
        ...miscFactions(ns),
        ...specialFactions(ns),
    ];
}

/**
 * Determine the category a faction belongs to.
 *
 * @param ns - Netscript API
 * @param faction - Faction to categorize
 * @returns Category name such as 'hacking' or 'company'
 */
export function factionType(ns: NS, faction: FactionName): string {
    const mapping: [string, FactionName[]][] = [
        ['location', locationFactions(ns)],
        ['hacking', hackingFactions(ns)],
        ['crime', crimeFactions(ns)],
        ['company', companyFactions(ns)],
        ['misc', miscFactions(ns)],
        ['special', specialFactions(ns)],
    ];
    for (const [type, list] of mapping) {
        if (list.includes(faction)) return type;
    }
    return 'unknown';
}

function locationFactions(ns: NS): FactionName[] {
    const fn = ns.enums.FactionName;
    return [
        fn.Aevum,
        fn.Chongqing,
        fn.Ishima,
        fn.NewTokyo,
        fn.Sector12,
        fn.Volhaven,
    ];
}

function hackingFactions(ns: NS): FactionName[] {
    const fn = ns.enums.FactionName;
    return [
        fn.CyberSec,
        fn.NiteSec,
        fn.TheBlackHand,
        fn.BitRunners,
        fn.Daedalus,
    ];
}

function crimeFactions(ns: NS): FactionName[] {
    const fn = ns.enums.FactionName;
    return [
        fn.SlumSnakes,
        fn.Tetrads,
        fn.SpeakersForTheDead,
        fn.TheDarkArmy,
        fn.TheSyndicate,
        fn.Silhouette,
        fn.Illuminati,
    ];
}

function companyFactions(ns: NS): FactionName[] {
    const fn = ns.enums.FactionName;
    return [
        fn.ECorp,
        fn.MegaCorp,
        fn.BachmanAssociates,
        fn.BladeIndustries,
        fn.NWO,
        fn.ClarkeIncorporated,
        fn.OmniTekIncorporated,
        fn.FourSigma,
        fn.KuaiGongInternational,
        fn.FulcrumSecretTechnologies,
    ];
}

function miscFactions(ns: NS): FactionName[] {
    const fn = ns.enums.FactionName;
    return [fn.TianDiHui, fn.TheCovenant, fn.Netburners];
}

function specialFactions(ns: NS): FactionName[] {
    const fn = ns.enums.FactionName;
    return [fn.ShadowsOfAnarchy, fn.Bladeburners, fn.ChurchOfTheMachineGod];
}
