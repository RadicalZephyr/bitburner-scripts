import type { CompanyName, NS, CompanyPositionInfo, Player } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { CONFIG } from 'automation/config';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);

    const sing = ns.singularity;

    const cmpEnum = ns.enums.CompanyName;
    const companies = [
        cmpEnum.BachmanAndAssociates,
        cmpEnum.BladeIndustries,
        cmpEnum.ClarkeIncorporated,
        cmpEnum.ECorp,
        cmpEnum.FourSigma,
        cmpEnum.FulcrumTechnologies,
        cmpEnum.KuaiGongInternational,
        cmpEnum.MegaCorp,
        cmpEnum.NWO,
        cmpEnum.OmniTekIncorporated,
    ];

    for (const c of companies) {
        const companyRep = sing.getCompanyRep(c);
        if (companyRep >= CONFIG.companyRepForFaction) continue;

        const jobToApply = bestJob(ns, c);
        if (!sing.applyToCompany(c, jobToApply.field)) {
            ns.print(`WARN: failed to apply to ${c}`);
        }
        await ns.asleep(0);
    }

    for (const c of companies) {
        await workUntilMax(ns, c);
    }
}

function bestJob(ns: NS, c: CompanyName) {
    const sing = ns.singularity;

    const favor = sing.getCompanyFavor(c);
    const player = ns.getPlayer();

    const companyRep = sing.getCompanyRep(c);

    const jobs = sing
        .getCompanyPositions(c)
        .map((j) => {
            const jobInfo = sing.getCompanyPositionInfo(c, j);
            const gains = ns.formulas.work.companyGains(player, c, j, favor);
            return {
                name: j,
                ...jobInfo,
                ...gains,
            };
        })
        .filter((j) => {
            return isHireable(player, companyRep, j);
        })
        .sort((a, b) => b.reputation - a.reputation);

    return jobs[0];
}

function isHireable(
    player: Player,
    companyRep: number,
    info: CompanyPositionInfo,
) {
    if (companyRep < info.requiredReputation) return false;
    for (const skill in player.skills) {
        if (player[skill] < info.requiredSkills[skill]) return false;
    }
    return true;
}

async function workUntilMax(ns: NS, c: CompanyName) {
    const sing = ns.singularity;

    while (true) {
        const companyRep = sing.getCompanyRep(c);
        if (companyRep >= CONFIG.companyRepForFaction) return;

        const myJob = ns.getPlayer().jobs[c];
        const nextJob = bestJob(ns, c);
        if (myJob !== nextJob.name) {
            if (!sing.applyToCompany(c, nextJob.field)) {
                ns.print(
                    'WARN: failed to apply to job that we should have been hireable for.',
                );
            }
        }
        if (!sing.workForCompany(c, false)) {
            ns.print('WARN: failed to start work for company.');
            return;
        }

        await ns.sleep(60_000);
    }
}
