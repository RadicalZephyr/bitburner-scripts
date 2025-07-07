import { walkNetworkBFS } from "util/walk";
const FACTION_SERVERS = [
    "CSEC",
    "avmnite-02h",
    "I.I.I.I",
    "run4theh111z",
    "The-Cave"
];
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    let tailOpen = false;
    while (true) {
        const factionMissingBackdoor = [];
        for (const host of FACTION_SERVERS) {
            const info = ns.getServer(host);
            if (needsBackdoor(info) && canInstallBackdoor(ns, info)) {
                factionMissingBackdoor.push(host);
                if (!tailOpen) {
                    tailOpen = true;
                    ns.ui.openTail();
                }
            }
        }
        if (tailOpen && factionMissingBackdoor.length === 0) {
            tailOpen = false;
            ns.ui.closeTail();
        }
        const network = walkNetworkBFS(ns);
        const missingBackdoor = [];
        for (const host of network.keys()) {
            const info = ns.getServer(host);
            if (!FACTION_SERVERS.includes(host) && needsBackdoor(info) && canInstallBackdoor(ns, info)) {
                missingBackdoor.push(host);
            }
        }
        const theme = ns.ui.getTheme();
        ns.clearLog();
        ns.printRaw(React.createElement(React.Fragment, null,
            React.createElement(ServerDisplay, { title: "Faction Servers", servers: factionMissingBackdoor, theme: theme }),
            React.createElement(ServerDisplay, { title: "Servers", servers: missingBackdoor, theme: theme })));
        ns.ui.renderTail();
        await ns.sleep(200);
    }
}
function needsBackdoor(info) {
    return !(info.hostname === "home" || info.purchasedByPlayer || info.backdoorInstalled);
}
function canInstallBackdoor(ns, info) {
    return ns.getHackingLevel() >= info.requiredHackingSkill;
}
/** Send a command to the terminal by simulating user input. */
export function sendCommand(command) {
    const terminalInput = globalThis.document.getElementById("terminal-input");
    terminalInput.value = command;
    const handler = Object.keys(terminalInput)[1];
    terminalInput[handler].onChange({ target: terminalInput });
    function enterKey() {
        terminalInput[handler].onKeyDown({ key: "Enter", preventDefault: () => null });
    }
    globalThis.setTimeout(enterKey, 10);
}
function ServerDisplay({ title, servers, theme }) {
    return (React.createElement("div", null,
        React.createElement("h2", null,
            title,
            " missing backdoors: ",
            servers.length),
        React.createElement("ul", null, servers.map((host) => (React.createElement("li", { key: host },
            React.createElement("a", { href: "#", onClick: () => {
                    sendCommand(`home ; whereis --goto  ${host}`);
                    globalThis.setTimeout(() => sendCommand("backdoor"), 500);
                }, style: { color: theme.success } }, host)))))));
}
