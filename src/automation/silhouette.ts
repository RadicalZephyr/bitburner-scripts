import type { NS, AutocompleteData, CompanyName } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';
import { bestJob } from 'automation/company-work';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

{{ description }}

Example:
  > {{ exampleUsages }}

OPTIONS
  --help   Show this help message
  {{ other FLAGS options }}

CONFIGURATION
  {{ CONFIG values used }}
`);
        return;
    }

    const company = ns.enums.CompanyName.BachmanAndAssociates;
    await workFor(ns, company);

    ns.spawn('/automation/faction-work.js', { threads: 1, spawnDelay: 0 });
}

async function workFor(ns: NS, companyName: CompanyName) {
    const chiefRe = /^Chief/;
    const sing = ns.singularity;

    while (true) {
        const myJobs = ns.getPlayer().jobs;
        if (chiefRe.test(myJobs[companyName])) return;

        const job = bestJob(ns, companyName);
        if (myJobs[companyName] !== job.name) {
            if (!sing.applyToCompany(companyName, job.field)) {
                ns.print(`WARN: failed to apply to ${companyName}`);
            }
        }

        if (!sing.workForCompany(companyName, false)) {
            ns.print(`WARN: failed to start work for ${companyName}`);
            return;
        }

        await ns.asleep(60_000);
    }
}
