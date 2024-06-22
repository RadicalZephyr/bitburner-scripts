import type { AutocompleteData, NS } from "netscript";

const crimes = ["Unassigned", "Ransomware", "Phishing", "Identity Theft", "DDoS Attacks", "Plant Virus", "Fraud & Counterfeiting", "Money Laundering", "Cyberterrorism", "Ethical Hacking", "Vigilante Justice", "Train Combat", "Train Hacking", "Train Charisma", "Territory Warfare"];

export function autocomplete(_data: AutocompleteData, _args: string[]) {
    return crimes;
}

export async function main(ns: NS) {
    const task = ns.args.join(" ");
    if (typeof task !== "string" || !crimes.includes(task)) {
        ns.tprintf("error: Unknown task specified '%s'", task);
        const formattedTaskNames = crimes.map(crime => " - " + crime).join("\n");
        ns.tprintf("Please choose one of the following tasks:\n%s", formattedTaskNames);
        return;
    }

    const members = ns.gang.getMemberNames();

    for (const member of members) {
        ns.gang.setMemberTask(member, task);
    }
}
