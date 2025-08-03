import type { CityName, NS } from 'netscript';

/**
 * Travel to city.
 *
 * @param ns   - Netscript API instance
 * @param city - City name
 */
export function travelTo(ns: NS, city: CityName) {
    if (ns.getServerMoneyAvailable('home') < 200_000)
        throw new Error(`not enough money to travel to ${city}`);
    if (!ns.singularity.travelToCity(city))
        throw new Error(`failed to travel to ${city}`);
}
