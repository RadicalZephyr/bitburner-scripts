import type { AutocompleteData, NS } from "netscript";

const crimes = ["Unassigned", "Mug People", "Deal Drugs", "Strongarm Civilians", "Run a Con", "Armed Robbery", "Traffick Illegal Arms", "Threaten & Blackmail", "Human Trafficking", "Terrorism", "Vigilante Justice", "Train Combat", "Train Hacking", "Train Charisma", "Territory Warfare"];

export function autocomplete(_data: AutocompleteData, _args: string[]) {
    return crimes.map(crime => '"' + crime + '"');
}

export async function main(ns: NS) {
    const task = ns.args[0];
    if (typeof task !== "string" || !crimes.includes(task)) {
        ns.tprintf("error: Unknown task specified '%s'", task);
        return;
    }

    const members = ns.gang.getMemberNames();

    for (const member of members) {
        ns.gang.setMemberTask(member, task);
    }
}
