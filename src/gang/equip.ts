import type { AutocompleteData, NS } from "netscript";

const augments = ["Bionic Arms", "Bionic Legs", "Bionic Spine", "BrachiBlades", "Nanofiber Weave", "Synthetic Heart", "Synfibril Muscle", "BitWire", "Neuralstimulator", "DataJack", "Graphene Bone Lacings"];

const weapons = ["Baseball Bat", "Katana", "Glock 18C", "P90C", "Steyr AUG", "AK-47", "M15A10 Assault Rifle", "AWM Sniper Rifle"];

const armor = ["Bulletproof Vest", "Full Body Armor", "Liquid Body Armor", "Graphene Plating Armor"];

const vehicles = ["Ford Flex V20", "ATX1070 Superbike", "Mercedes-Benz S9001", "White Ferrari"];

const rootkits = ["NUKE Rootkit", "Soulstealer Rootkit", "Demon Rootkit", "Hmap Node", "Jack the Ripper"];

const all_equipment = [...augments, ...weapons, ...armor, ...vehicles, ...rootkits];

const equipment_categories = {
    "Augments": augments,
    "Weapons": weapons,
    "Armor": armor,
    "Vehicles": vehicles,
    "Rootkits": rootkits
};

export function autocomplete(_data: AutocompleteData, args: string[]) {
    if (args.length > 0) {
        return all_equipment.filter(a => a.startsWith(args[0])).map(a => a.replace(args[0] + ' ', ''));
    } else {
        return all_equipment;
    }
}

export async function main(ns: NS) {
    const equipment = ns.args.join(" ");
    if (typeof equipment !== "string" || !all_equipment.includes(equipment)) {
        ns.tprintf("error: Unknown equipment specified '%s'", equipment);
        ns.tprint("\nPlease choose one of the following equipments:");

        for (const [category, items] of Object.entries(equipment_categories)) {
            ns.tprint(format_equipment(category, items));
        }

        return;
    }

    const members = ns.gang.getMemberNames().map(name => ns.gang.getMemberInformation(name));
    let boughtFor = [];
    for (const member of members) {
        if (!member.upgrades.includes(equipment)) {
            if (ns.gang.purchaseEquipment(member.name, equipment)) {
                boughtFor.push(member.name);
            }

        }
    }

    if (boughtFor.length > 0) {
        ns.tprintf("Bought %s for %s", equipment, boughtFor.join(", "));
    } else {
        ns.tprintf("All gang members already equipped with %s", equipment);
    }
}

function format_equipment(name: string, equipments: string[]): string {
    const equipmentList = equipments.map(equipment => " - " + equipment).join("\n");
    return `
${name}:
${equipmentList}
`;
}
