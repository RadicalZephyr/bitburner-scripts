import type { AutocompleteData, NS } from "netscript";

const augments = ["Bionic Arms", "Bionic Legs", "Bionic Spine", "BrachiBlades", "Nanofiber Weave", "Synthetic Heart", "Synfibril Muscle", "BitWire", "Neuralstimulator", "DataJack", "Graphene Bone Lacings"];

// const weapons = ["Baseball Bat", "Katana", "Glock 18C", "P90C", "Steyr AUG", "AK-47", "M15A10 Assault Rifle", "AWM Sniper Rifle"];

// const armor = ["Bulletproof Vest", "Full Body Armor", "Liquid Body Armor", "Graphene Plating Armor"];

// const vehicles = ["Ford Flex V20", "ATX1070 Superbike", "Mercedes-Benz S9001", "White Ferrari"];

// const rootkits = ["NUKE Rootkit", "Soulstealer Rootkit", "Demon Rootkit", "Hmap Node", "Jack the Ripper"];

export function autocomplete(_data: AutocompleteData, args: string[]) {
    if (args.length > 0) {
        return augments.filter(a => a.startsWith(args[0])).map(a => a.replace(args[0] + ' ', ''));
    } else {
        return augments;
    }

}

export async function main(ns: NS) {
    const augment = ns.args.join(" ");
    if (typeof augment !== "string" || !augments.includes(augment)) {
        ns.tprintf("error: Unknown augment specified '%s'", augment);
        const formattedTaskNames = augments.map(augment => " - " + augment).join("\n");
        ns.tprintf("Please choose one of the following augments:\n%s", formattedTaskNames);
        return;
    }

    const members = ns.gang.getMemberNames().map(name => ns.gang.getMemberInformation(name));
    let boughtFor = [];
    for (const member of members) {
        if (!member.upgrades.includes(augment)) {
            if (ns.gang.purchaseEquipment(member.name, augment)) {
                boughtFor.push(member.name);
            }

        }
    }

    if (boughtFor.length > 0) {
        ns.tprintf("Bought %s for %s", augment, boughtFor.join(", "));
    } else {
        ns.tprintf("All gang members already equipped with %s", augment);
    }
}
