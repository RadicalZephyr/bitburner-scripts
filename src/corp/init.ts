import { CityName, type NS } from "netscript";

const CORPORATION_NAME = "Turtle Vision";
const AGRI_DIVISION = "Sift & Sow Farms";
const CHEM_DIVISION = "Ruwen's Runic Elixirs";
const TOBACCO_DIVISION = "Leaf it to Lylan";

const CITIES = [
    CityName.Aevum,
    CityName.Chongqing,
    CityName.Sector12,
    CityName.NewTokyo,
    CityName.Ishima,
    CityName.Volhaven
];

export async function main(ns: NS) {
    const flags = ns.flags([
        ['self', false],
        ['help', false]
    ]);

    if ((typeof flags.help !== 'boolean' && flags.help) || typeof flags.self !== 'boolean') {
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

    const selfFund = flags.self;

    const corp = ns.corporation;
    if (!corp.hasCorporation()) {
        if (!corp.canCreateCorporation(selfFund)) {
            ns.tprint("not in a corporation!");
            return;
        }

        if (!corp.createCorporation(CORPORATION_NAME, selfFund)) {
            ns.tprint("could not create corporation, you may need to self-fund it!");
            return;
        }
    }

    const c = corp.getCorporation();

    if (-1 === c.divisions.findIndex(d => d === AGRI_DIVISION)) {
        corp.expandIndustry("Agriculture", AGRI_DIVISION);
    }

    for (const city of CITIES) {
        corp.expandCity(AGRI_DIVISION, city);
        corp.getWarehouse(AGRI_DIVISION, city);
        corp.upgradeOfficeSize(AGRI_DIVISION, city, 4);
    }
}
