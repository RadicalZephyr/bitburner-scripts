import type { FactionName, NS } from '@ns';
import { parseFlags } from 'util/flags';

import { withPlugins } from 'ns/extend';
import { alivePlugin } from 'ns/plugins/alive';

function extendNs(ns: NS) {
    return withPlugins(ns, alivePlugin());
}

type NSX = ReturnType<typeof extendNs>;

export async function main(ns: NS) {
    await parseFlags(ns, []);

    const nsx = extendNs(ns);

    void acceptInvites(nsx);
    void pursueInvites(nsx);

    return await nsx.alive.untilKilled();
}

async function acceptInvites(ns: NSX) {
    const sing = ns.singularity;

    while (ns.alive.isAlive()) {
        const factionInvites = sing.checkFactionInvitations();

        for (const f of factionInvites) {
            if (sing.getFactionEnemies(f).length > 0) continue;
            sing.joinFaction(f);
        }
        await ns.asleep(1000);
    }
}

async function pursueInvites(ns: NSX) {
    const myFactions = new Set(ns.getPlayer().factions);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const factionsToJoin = allFactions(ns).filter((f) => !myFactions.has(f));
    await ns.asleep(100);
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
