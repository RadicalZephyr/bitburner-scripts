import type { AutocompleteData, NS } from "netscript";

const augments = ["Bionic Arms", "Bionic Legs", "Bionic Spine", "BrachiBlades", "Nanofiber Weave", "Synthetic Heart", "Synfibril Muscle", "BitWire", "Neuralstimulator", "DataJack", "Graphene Bone Lacings"];

const weapons = ["Baseball Bat", "Katana", "Glock 18C", "P90C", "Steyr AUG", "AK-47", "M15A10 Assault Rifle", "AWM Sniper Rifle"];

const armor = ["Bulletproof Vest", "Full Body Armor", "Liquid Body Armor", "Graphene Plating Armor"];

const vehicles = ["Ford Flex V20", "ATX1070 Superbike", "Mercedes-Benz S9001", "White Ferrari"];

const rootkits = ["NUKE Rootkit", "Soulstealer Rootkit", "Demon Rootkit", "Hmap Node", "Jack the Ripper"];

const allEquipment = [...augments, ...weapons, ...armor, ...vehicles, ...rootkits];
const allEquipmentLC = allEquipment.map(e => e.toLowerCase());

const equipmentCategories = {
    "Augments": augments,
    "Weapons": weapons,
    "Armor": armor,
    "Vehicles": vehicles,
    "Rootkits": rootkits
};

const FLAGS: [flag: string, default_value: boolean][] = [
    ['g', false], // all augments
    ['w', false], // all weapons
    ['m', false], // all armors
    ['v', false], // all vehicles
    ['r', false], // all rootkits
    ['A', false]  // All
];

export function autocomplete(_data: AutocompleteData, _args: string[]) {
    const args = _args.map(a => a.toLowerCase());

    // Eat any flags
    const flagLetters = FLAGS.map(f => '-' + f[0]);
    while (args.length > 0 && flagLetters.includes(args[0])) {
        args.shift();
    }

    const [specifiedEquipment, rest] = extractValidEquipments(args);
    // pop last item for completion
    const restEquipmentName = rest.join(' ');
    rest.pop();
    const restEquipmentPrefix = new RegExp(rest.join(' '), 'i');

    if (!allEquipmentLC.includes(restEquipmentName) && restEquipmentName != '') {
        return allEquipment
            .filter(e => e.toLowerCase().startsWith(restEquipmentName))
            .map(e => e.replace(restEquipmentPrefix, '').trimStart());
    } else {
        return allEquipment.filter(e => !specifiedEquipment.includes(e));
    }
}

export async function main(ns: NS) {
    const options = ns.flags(FLAGS);

    const [equipmentList, rest] = buildEquipmentList(options);

    if (options.help || !isSubSet(equipmentList, allEquipment)) {
        let errorMsg: string;
        if (equipmentList.length == 0) {
            errorMsg = "No equipment specified";
        } else {
            errorMsg = `Unknown equipment specified ${rest}`;
        }

        let formattedEquipment = new String();
        for (const [category, items] of Object.entries(equipmentCategories)) {
            formattedEquipment += formatEquipment(category, items);
        }
        ns.tprintf('error: %s\nPlease choose one of the following equipments:\n %s', errorMsg, formattedEquipment);
        return;
    }

    const members = ns.gang.getMemberNames().map(name => ns.gang.getMemberInformation(name));

    let boughtList: [equipment: string, members: string[]][] = [];
    for (const equipment of equipmentList) {
        let boughtFor = [];
        for (const member of members) {
            if (!member.upgrades.includes(equipment)) {
                if (ns.gang.purchaseEquipment(member.name, equipment)) {
                    boughtFor.push(member.name);
                }
            }
        }
        if (boughtFor.length > 0) {
            boughtList.push([equipment, boughtFor]);
        }
    }

    if (boughtList.length > 0) {
        let formattedBoughtEquipment = [];
        for (const [equipment, members] of boughtList) {
            formattedBoughtEquipment.push(`Bought ${equipment} for ${members.join(", ")}`);
        }
        ns.tprint(formattedBoughtEquipment.join('\n'));
    } else {
        ns.tprintf("All gang members already equipped with %s", equipmentList.join(", "));
    }
}

type Options = {
    g: boolean,
    w: boolean,
    m: boolean,
    v: boolean,
    r: boolean,
    A: boolean,
    _: string[]
};

type Equipment = [
    equipments: string[],
    rest: string[]
];

function buildEquipmentList(options: Options): Equipment {
    let equipments: string[] = [];

    if (options.A) {
        return [allEquipment, []];
    }

    if (options.g) {
        equipments.push(...augments);
    }

    if (options.w) {
        equipments.push(...weapons);
    }

    if (options.m) {
        equipments.push(...armor);
    }

    if (options.v) {
        equipments.push(...vehicles);
    }

    if (options.r) {
        equipments.push(...rootkits);
    }

    let rest: string[] = [];
    if (options._.length > 0) {
        const [explicitEquipment, explicitRest] = extractValidEquipments([...options._]);
        equipments.push(...explicitEquipment);
        rest = explicitRest;
    }

    return [equipments, rest];
}

export function extractValidEquipments(_args: string[]): Equipment {
    let args = [..._args];

    let equipments: string[] = [];
    let currentEquipment = [];

    while (args.length > 0) {
        currentEquipment.push(args.shift());
        const currentEquipmentName = currentEquipment.join(' ');
        const currentEquipmentRE = new RegExp('^' + currentEquipmentName, 'i');
        const filteredEquipment = allEquipment.filter(e => currentEquipmentRE.test(e));

        if (filteredEquipment.length == 1) {
            const currentEquipmentTotalRE = new RegExp('^' + currentEquipmentName + '$', 'i');
            if (currentEquipmentTotalRE.test(filteredEquipment[0])) {
                equipments.push(currentEquipmentName);
                currentEquipment = [];
            }
        } else if (filteredEquipment.length == 0) {
            break;
        }
    }
    args = currentEquipment.concat(args);

    return [equipments, args];
}

function formatEquipment(name: string, equipments: string[]): string {
    const equipmentList = equipments.map(equipment => " - " + equipment).join("\n");
    return `
${name}:
${equipmentList}
`;
}

function isSubSet(potentialSubSet: string[], superSet: string[]): boolean {
    for (const el of potentialSubSet) {
        if (!superSet.includes(el)) {
            return false;
        }
    }

    return true;
}
