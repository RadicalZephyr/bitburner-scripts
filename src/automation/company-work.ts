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
    ns.tprint('finished company work');
}

class Company {
    name: CompanyName;
    rep: number;

    constructor(ns: NS, name: CompanyName) {
        this.name = name;
        this.rep = ns.singularity.getCompanyRep(name);
    }
}

async function workForCompanies(ns: NS) {
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

    const sing = ns.singularity;

    while (true) {
        const player = ns.getPlayer();
        const factions = new Set(player.factions);
        const myJobs = player.jobs;

        const unfinished = companies
            .map((c) => new Company(ns, c))
            .filter((c) => unfinishedCompany(c, factions));

        if (unfinished.length === 0) return;

        unfinished.sort((a, b) => a.rep - b.rep);
        const target = unfinished[0];

        const job = bestJob(ns, target.name);

        // If no job exists, remove this company from our list of
        // companies to work for.
        if (!job) {
            const targetIndex = companies.findIndex(
                (name) => name === target.name,
            );
            companies.splice(targetIndex, 1);
            continue;
        }

        if (myJobs[target.name] !== job.name) {
            if (!sing.applyToCompany(target.name, job.field)) {
                ns.print(`WARN: failed to apply to ${target.name}`);
            }
        }

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
