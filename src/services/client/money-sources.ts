import { MoneySource } from '@ns';

import { ApiCell } from 'util/sodium-api';

function dummyMoneySource(): MoneySource {
    return {
        bladeburner: 0,
        casino: 0,
        class: 0,
        codingcontract: 0,
        corporation: 0,
        crime: 0,
        gang: 0,
        gang_expenses: 0,
        hacking: 0,
        hacknet: 0,
        hacknet_expenses: 0,
        hospitalization: 0,
        infiltration: 0,
        sleeves: 0,
        stock: 0,
        total: 0,
        work: 0,
        servers: 0,
        other: 0,
        augmentations: 0,
    };
}

export const SinceInstall = new ApiCell<MoneySource>(dummyMoneySource());

/**
 * Get current MoneySource since the last install.
 */
export function getMoneySourceSinceInstall(): MoneySource {
    return SinceInstall.cell.sample();
}

export const SinceStart = new ApiCell<MoneySource>(dummyMoneySource());

/**
 * Get current MoneySource since the start.
 */
export function getMoneySourceSinceStart(): MoneySource {
    return SinceStart.cell.sample();
}
