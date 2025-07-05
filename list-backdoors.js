import { walkNetworkBFS } from "util/walk";
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();
    while (true) {
        const network = walkNetworkBFS(ns);
        const missingBackdoor = [];
        for (const host of network.keys()) {
            const info = ns.getServer(host);
            if (needsBackdoor(info) && canInstallBackdoor(ns, info)) {
                missingBackdoor.push(host);
            }
        }
        const theme = ns.ui.getTheme();
        ns.clearLog();
        ns.printRaw(React.createElement(ServerDisplay, { servers: missingBackdoor, theme: theme }));
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
function ServerDisplay({ servers, theme }) {
    return (React.createElement("div", null,
        React.createElement("h2", null,
            "Servers missing backdoors: ",
            servers.length),
        React.createElement("ul", null, servers.map((host) => (React.createElement("li", { key: host },
            React.createElement("a", { href: "#", onClick: () => {
                    sendCommand(`home ; whereis --goto  ${host}`);
                    globalThis.setTimeout(() => sendCommand("backdoor"), 500);
                }, style: { color: theme.success } }, host)))))));
}
