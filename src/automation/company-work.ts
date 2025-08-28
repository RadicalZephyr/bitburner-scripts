import type {
    AutocompleteData,
    CompanyName,
    CompanyPositionInfo,
    Player,
    NS,
} from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { CONFIG } from 'automation/config';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.print(`
USAGE: run ${ns.getScriptName()}

Work for companies until reaching the reputation needed for their faction invite.

OPTIONS
  --help           Show this help message

CONFIGURATION
  AUTO_companyRepForFaction  Sets the target reputation for getting invited to the company faction.
`);
        return;
    }

    await workForCompanies(ns);
    ns.tprint('finished all company work');
    await becomeCeo(ns);
}

class Company {
    name: CompanyName;
    rep: number;

    constructor(ns: NS, name: CompanyName) {
        this.name = name;
        this.rep = ns.singularity.getCompanyRep(name);
    }
}

function allMegaCorps(ns: NS) {
    const cmpEnum = ns.enums.CompanyName;
    const companies: CompanyName[] = [
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
    return companies;
}

async function workForCompanies(ns: NS) {
    const companies: CompanyName[] = allMegaCorps(ns);

    const sing = ns.singularity;

    while (true) {
        const player = ns.getPlayer();
        const factions = new Set(player.factions);

        const unfinished = companies
            .map((c) => new Company(ns, c))
            .filter((c) => unfinishedCompany(c, factions));

        if (unfinished.length === 0) return;

        unfinished.sort((a, b) => a.rep - b.rep);
        const target = unfinished[0];

        applyToBestJob(ns, target);

        if (!sing.workForCompany(target.name, ns.singularity.isFocused())) {
            ns.print(`WARN: failed to start work for ${target.name}`);
            return;
        }

        await ns.asleep(CONFIG.companyWorkTimeMs);
    }
}

async function becomeCeo(ns: NS) {
    const companies: CompanyName[] = allMegaCorps(ns);

    const sing = ns.singularity;

    while (true) {
        const player = ns.getPlayer();

        const factions = new Set(player.factions);
        if (factions.has(ns.enums.FactionName.Silhouette)) {
            return;
        }

        const jobCompanies = companies.map((c) => new Company(ns, c));
        if (jobCompanies.length === 0)
            throw new Error('All companies somehow removed from work list!');

        jobCompanies.sort((a, b) => b.rep - a.rep);

        const target = jobCompanies[0];

        applyToBestJob(ns, target);

        if (!sing.workForCompany(target.name, ns.singularity.isFocused())) {
            ns.print(`WARN: failed to start work for ${target.name}`);
            return;
        }

        await ns.asleep(CONFIG.companyWorkTimeMs);
    }
}

function unfinishedCompany(c: Company, factions: Set<string>): boolean {
    return !factions.has(c.name) && c.rep < CONFIG.companyRepForFaction;
}

function applyToBestJob(ns: NS, c: Company) {
    const job = bestJob(ns, c.name);

    if (!job) throw new Error(`${c.name} has no jobs to work!`);

    const myJobs = ns.getPlayer().jobs;

    // We're already working the best job we can!
    if (myJobs[c.name] === job.name) return;

    if (!ns.singularity.applyToCompany(c.name, job.field)) {
        throw new Error(`WARN: failed to apply to ${c.name}`);
    }
}

/**
 * Return the job that earns the most rep/s at company `c` that the
 * player has the stats to be hired for.
 *
 * @param ns - Netscript API instance
 * @param c  - Company to check jobs for
 * @returns The best job at company `c`
 */
export function bestJob(ns: NS, c: CompanyName): CompanyPositionInfo | null {
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

    if (jobs.length > 0) return jobs[0];

    return null;
}

function isHireable(
    player: Player,
    companyRep: number,
    info: CompanyPositionInfo,
) {
    if (companyRep < info.requiredReputation) return false;
    for (const skill in player.skills) {
        if (player.skills[skill] < info.requiredSkills[skill]) return false;
    }
    return true;
}
