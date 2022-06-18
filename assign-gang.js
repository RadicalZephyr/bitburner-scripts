const crimes = ["Unassigned", "Mug People", "Deal Drugs", "Strongarm Civilians", "Run a Con", "Armed Robbery", "Traffick Illegal Arms", "Threaten & Blackmail", "Human Trafficking", "Terrorism", "Vigilante Justice", "Train Combat", "Train Hacking", "Train Charisma", "Territory Warfare"];
export function autocomplete(_data, _args) {
    return crimes;
}
export async function main(ns) {
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
