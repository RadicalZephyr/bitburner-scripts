import type { AutocompleteData, NS } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { AGRI_DIVISION, CITIES, CORPORATION_NAME } from 'corp/constants';
import { DispatchClient } from '/services/client/dispatch';

const FLAGS = [
    ['self', false],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (
        (typeof flags.help !== 'boolean' && flags.help)
        || typeof flags.self !== 'boolean'
    ) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Create our corporation and initial agriculture division.

OPTIONS
  --help Display this help message
  --self Self fund starting your corporation (need +$150 billion)

Example:
  > run ${ns.getScriptName()}
`);
        return;
    }

    await initCorporation(ns, flags.self);
}

async function initCorporation(ns: NS, selfFund: boolean) {
    const dispatchClient = new DispatchClient(ns);
    const _ns = dispatchClient.dispatch.bind(
        dispatchClient,
    ) as (typeof dispatchClient)['dispatch'];

    if (!ns.corporation.hasCorporation()) {
        if (!(await _ns('corporation.canCreateCorporation', selfFund))) {
            const description = selfFund
                ? 'by self-funding'
                : 'with government seed money';
            ns.ui.openTail();
            ns.print(`ERROR: cannot create a corporation ${description}`);
            return;
        }

        if (
            !(await _ns(
                'corporation.createCorporation',
                CORPORATION_NAME,
                selfFund,
            ))
        ) {
            ns.ui.openTail();
            ns.print(
                'could not create corporation, you may need to self-fund it!',
            );
            return;
        }
    }

    const c = await _ns('corporation.getCorporation');
    const divisions = await Promise.all(
        c.divisions.map((name) => _ns('corporation.getDivision', name)),
    );

    let agriDivision = divisions.find((d) => d.type === 'Agriculture');
    if (!agriDivision) {
        await _ns('corporation.expandIndustry', 'Agriculture', AGRI_DIVISION);
        agriDivision = await _ns('corporation.getDivision', AGRI_DIVISION);
        if (!agriDivision) {
            ns.ui.openTail();
            ns.print(`WARN: Could not expand into Agriculture`);
            return;
        }
    }

    const agriCities = new Set(agriDivision.cities);
    for (const city of CITIES) {
        if (!agriCities.has(city)) {
            await _ns('corporation.expandCity', agriDivision.name, city);
        }

        const office = await _ns(
            'corporation.getOffice',
            agriDivision.name,
            city,
        );
        if (!office) {
            ns.ui.openTail();
            ns.print(
                `WARN: Could not open a ${agriDivision.name} office in ${city}`,
            );
            return;
        }

        if (office.size < 4) {
            const seatsToAdd = Math.max(0, 4 - office.size);
            await _ns(
                'corporation.upgradeOfficeSize',
                agriDivision.name,
                city,
                seatsToAdd,
            );
        }
        for (let i = office.numEmployees; i < 4; i++) {
            await _ns('corporation.hireEmployee', agriDivision.name, city);
        }
        await _ns(
            'corporation.setAutoJobAssignment',
            agriDivision.name,
            city,
            'Research & Development',
            4,
        );

        const warehouse = await _ns(
            'corporation.getWarehouse',
            agriDivision.name,
            city,
        );
        if (!warehouse) {
            await _ns('corporation.purchaseWarehouse', agriDivision.name, city);
        }
    }
}
