import type { FactionWorkType, NS } from 'netscript';

export async function main(ns: NS) {
    const sing = ns.singularity;

    const factions = ns.getPlayer().factions;

    for (const f of factions) {
        const augs = sing.getAugmentationsFromFaction(f);
        if (augs.length < 1) continue;

        augs.sort(
            (a, b) =>
                sing.getAugmentationRepReq(b) - sing.getAugmentationRepReq(a),
        );

        const targetRep = sing.getAugmentationRepReq(augs[0]);

        const workTypes = sing.getFactionWorkTypes(f);
        if (workTypes.length < 1) continue;

        const player = ns.getPlayer();
        const favor = sing.getFactionFavor(f);
        if (favor > ns.getFavorToDonate()) continue;

        function factionGains(w: FactionWorkType) {
            return ns.formulas.work.factionGains(player, w, favor);
        }

        function compareWorkGains(a: FactionWorkType, b: FactionWorkType) {
            return factionGains(b).reputation - factionGains(a).reputation;
        }

        workTypes.sort(compareWorkGains);

        sing.workForFaction(f, workTypes[0]);

        while (
            targetRep > sing.getFactionRep(f)
            && favor + sing.getFactionFavorGain(f) < ns.getFavorToDonate()
        ) {
            await ns.sleep(1000);
        }
    }
}
