import type {
    AutocompleteData,
    CityName,
    CorporationInfo,
    Division,
    NS,
} from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';
import { DispatchClient, DispatchFn } from 'services/client/dispatch';

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

Purchase corporation upgrades for investment round 2.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    if (!ns.corporation.hasCorporation()) {
        ns.tprint(`You don't have a corporation, run corp/init.js first!`);
        return;
    }

    await upgradeRound2(ns);
}

async function upgradeRound2(ns: NS) {
    const dispatchClient = new DispatchClient(ns);
    const _ns = dispatchClient.dispatch.bind(dispatchClient) as DispatchFn;

    const corpInfo = await _ns('corporation.getCorporation');

    for (const divName of corpInfo.divisions)
        await upgradeDivision(ns, _ns, divName);
}

async function upgradeDivision(ns: NS, _ns: DispatchFn, divName: string) {
    const division = await _ns('corporation.getDivision', divName);
    for (const city of division.cities) {
        await upgradeOffice(ns, _ns, division, city);
    }
}

async function upgradeOffice(
    ns: NS,
    _ns: DispatchFn,
    division: Division,
    city: CityName,
) {
    const office = await _ns('corporation.getOffice', division.name, city);

    const newOfficeSize = 8;
    if (office.size < newOfficeSize) {
        const seatsToAdd = Math.max(0, newOfficeSize - office.size);
        await _ns(
            'corporation.upgradeOfficeSize',
            division.name,
            city,
            seatsToAdd,
        );
    }
    for (let i = office.numEmployees; i < newOfficeSize; i++) {
        await _ns('corporation.hireEmployee', division.name, city);
    }

    for (const job in office.employeeJobs) {
        if (office.employeeJobs[job] === 0) continue;
        await _ns(
            'corporation.setAutoJobAssignment',
            division.name,
            city,
            job,
            0,
        );
    }
    await _ns(
        'corporation.setAutoJobAssignment',
        division.name,
        city,
        'Research & Development',
        newOfficeSize,
    );
}
