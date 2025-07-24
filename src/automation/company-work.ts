import type { CompanyName, NS, CompanyPositionInfo, Player } from 'netscript';

export async function main(ns: NS) {
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
        const jobToApply = bestJob(ns, c);
        if (!sing.applyToCompany(c, jobToApply.field)) {
            ns.print(`WARN: failed to apply to ${c}`);
        }
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
        if (player[skill] < info.requiredSkills) return false;
    }
    return true;
}
