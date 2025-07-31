import type { FactionName, NS } from 'netscript';
import { parseFlags } from 'util/flags';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    acceptInvites(ns);
    pursueInvites(ns);

    while (true) {
        await ns.asleep(60_000);
    }
}

async function acceptInvites(ns: NS) {
    let running = true;
    ns.atExit(() => {
        running = false;
    }, 'acceptInvites');

    const sing = ns.singularity;
    while (running) {
        const factionInvites = sing.checkFactionInvitations();

        for (const f of factionInvites) {
            if (sing.getFactionEnemies(f).length > 0) continue;
            sing.joinFaction(f);
        }
        await ns.asleep(1000);
    }
}

async function pursueInvites(ns: NS) {
    const myFactions = new Set(ns.getPlayer().factions);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const factionsToJoin = allFactions(ns).filter((f) => !myFactions.has(f));
}

function allFactions(ns: NS): FactionName[] {
    return [
        ...locationFactions(ns),
        ...hackingFactions(ns),
        ...crimeFactions(ns),
        ...companyFactions(ns),
        ...miscFactions(ns),
        ...specialFactions(ns),
    ];
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
