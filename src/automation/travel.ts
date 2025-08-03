import type { CityName, LocationName, NS } from 'netscript';

/**
 * Travel to city.
 *
 * @param ns   - Netscript API instance
 * @param city - City name
 */
export function travelTo(ns: NS, city: CityName) {
    if (ns.getPlayer().city === city) return;

    if (ns.getServerMoneyAvailable('home') < 200_000)
        throw new Error(`not enough money to travel to ${city}`);
    if (!ns.singularity.travelToCity(city))
        throw new Error(`failed to travel to ${city}`);
}

/**
 * Travel to the city where a location is.
 *
 * @param ns       - Netscript API instance
 * @param location - Location name
 */
export function travelToCityForLocation(
    ns: NS,
    location: LocationName | `${LocationName}`,
) {
    const city = cityForLocation(ns, location);
    if (!city) {
        ns.print(`ERROR: ${location} not found, no city mapping exists.`);
        return;
    }
    travelTo(ns, city);
}

function cityForLocation(
    ns: NS,
    location: LocationName | `${LocationName}`,
): CityName | null {
    if (anyCityLocation(ns).has(location as LocationName))
        return ns.getPlayer().city;

    const ctl = cityToLocation(ns);

    for (const [city, locations] of ctl) {
        if (locations.has(location as LocationName)) return city;
    }
    return null;
}

function cityToLocation(ns: NS): Map<CityName, Set<LocationName>> {
    const cityToLocation = new Map();

    cityToLocation.set(ns.enums.CityName.Aevum, aevumLocations(ns));
    cityToLocation.set(ns.enums.CityName.Chongqing, chongqingLocations(ns));
    cityToLocation.set(ns.enums.CityName.Ishima, ishimaLocations(ns));
    cityToLocation.set(ns.enums.CityName.NewTokyo, newTokyoLocations(ns));
    cityToLocation.set(ns.enums.CityName.Sector12, sector12Locations(ns));
    cityToLocation.set(ns.enums.CityName.Volhaven, volhavenLocations(ns));

    return cityToLocation;
}

function aevumLocations(ns: NS): Set<LocationName> {
    return new Set([
        ns.enums.LocationName.AevumAeroCorp,
        ns.enums.LocationName.AevumBachmanAndAssociates,
        ns.enums.LocationName.AevumClarkeIncorporated,
        ns.enums.LocationName.AevumCrushFitnessGym,
        ns.enums.LocationName.AevumECorp,
        ns.enums.LocationName.AevumFulcrumTechnologies,
        ns.enums.LocationName.AevumGalacticCybersystems,
        ns.enums.LocationName.AevumNetLinkTechnologies,
        ns.enums.LocationName.AevumPolice,
        ns.enums.LocationName.AevumRhoConstruction,
        ns.enums.LocationName.AevumSnapFitnessGym,
        ns.enums.LocationName.AevumSummitUniversity,
        ns.enums.LocationName.AevumWatchdogSecurity,
        ns.enums.LocationName.AevumCasino,
    ]);
}

function chongqingLocations(ns: NS): Set<LocationName> {
    return new Set([
        ns.enums.LocationName.ChongqingKuaiGongInternational,
        ns.enums.LocationName.ChongqingSolarisSpaceSystems,
        ns.enums.LocationName.ChongqingChurchOfTheMachineGod,
    ]);
}

function ishimaLocations(ns: NS): Set<LocationName> {
    return new Set([
        ns.enums.LocationName.IshimaNovaMedical,
        ns.enums.LocationName.IshimaOmegaSoftware,
        ns.enums.LocationName.IshimaStormTechnologies,
        ns.enums.LocationName.IshimaGlitch,
    ]);
}

function newTokyoLocations(ns: NS): Set<LocationName> {
    return new Set([
        ns.enums.LocationName.NewTokyoDefComm,
        ns.enums.LocationName.NewTokyoGlobalPharmaceuticals,
        ns.enums.LocationName.NewTokyoNoodleBar,
        ns.enums.LocationName.NewTokyoVitaLife,
        ns.enums.LocationName.NewTokyoArcade,
    ]);
}

function sector12Locations(ns: NS): Set<LocationName> {
    return new Set([
        ns.enums.LocationName.Sector12AlphaEnterprises,
        ns.enums.LocationName.Sector12BladeIndustries,
        ns.enums.LocationName.Sector12CIA,
        ns.enums.LocationName.Sector12CarmichaelSecurity,
        ns.enums.LocationName.Sector12CityHall,
        ns.enums.LocationName.Sector12DeltaOne,
        ns.enums.LocationName.Sector12FoodNStuff,
        ns.enums.LocationName.Sector12FourSigma,
        ns.enums.LocationName.Sector12IcarusMicrosystems,
        ns.enums.LocationName.Sector12IronGym,
        ns.enums.LocationName.Sector12JoesGuns,
        ns.enums.LocationName.Sector12MegaCorp,
        ns.enums.LocationName.Sector12NSA,
        ns.enums.LocationName.Sector12PowerhouseGym,
        ns.enums.LocationName.Sector12RothmanUniversity,
        ns.enums.LocationName.Sector12UniversalEnergy,
    ]);
}

function volhavenLocations(ns: NS): Set<LocationName> {
    return new Set([
        ns.enums.LocationName.VolhavenCompuTek,
        ns.enums.LocationName.VolhavenHeliosLabs,
        ns.enums.LocationName.VolhavenLexoCorp,
        ns.enums.LocationName.VolhavenMilleniumFitnessGym,
        ns.enums.LocationName.VolhavenNWO,
        ns.enums.LocationName.VolhavenOmniTekIncorporated,
        ns.enums.LocationName.VolhavenOmniaCybersystems,
        ns.enums.LocationName.VolhavenSysCoreSecurities,
        ns.enums.LocationName.VolhavenZBInstituteOfTechnology,
    ]);
}

function anyCityLocation(ns: NS): Set<LocationName> {
    return new Set([
        ns.enums.LocationName.Hospital,
        ns.enums.LocationName.Slums,
        ns.enums.LocationName.TravelAgency,
        ns.enums.LocationName.WorldStockExchange,
        ns.enums.LocationName.Void,
    ]);
}
