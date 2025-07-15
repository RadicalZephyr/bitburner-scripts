import type { NS, Server, UserInterfaceTheme } from "netscript";

import { walkNetworkBFS } from "util/walk";

declare const React: any;

const FACTION_SERVERS = [
    "CSEC",
    "avmnite-02h",
    "I.I.I.I",
    "run4theh111z",
    "The-Cave"
];

export async function main(ns: NS) {
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
        const missingBackdoor: string[] = [];

        for (const host of network.keys()) {
            const info = ns.getServer(host);
            if (!FACTION_SERVERS.includes(host) && needsBackdoor(info) && canInstallBackdoor(ns, info)) {
                missingBackdoor.push(host);
            }
        }

        const theme = ns.ui.getTheme();
        ns.clearLog();
        ns.printRaw(<>
            <ServerDisplay title={"Faction Servers"} servers={factionMissingBackdoor} theme={theme} />
            <ServerDisplay title={"Servers"} servers={missingBackdoor} theme={theme} />
        </>);
        ns.ui.renderTail();
        await ns.sleep(200);
    }
}

function needsBackdoor(info: Server) {
    return !(info.hostname === "home" || info.purchasedByPlayer || info.backdoorInstalled);
}

function canInstallBackdoor(ns: NS, info: Server) {
    return ns.getHackingLevel() >= info.requiredHackingSkill;
}

/** Send a command to the terminal by simulating user input. */
export function sendCommand(command: string): void {
    const terminalInput: any = globalThis["terminal-input"];
    terminalInput.value = command;
    const handler = Object.keys(terminalInput)[1];
    terminalInput[handler].onChange({ target: terminalInput });
    function enterKey() {
        terminalInput[handler].onKeyDown({ key: "Enter", preventDefault: (): void => null });
    }
    globalThis.setTimeout(enterKey, 10);
}


interface ServerDisplayProps {
    title: string;
    servers: string[];
    theme: UserInterfaceTheme;
}

function ServerDisplay({ title, servers, theme }: ServerDisplayProps) {
    return (
        <div>
            <h2>{title} missing backdoors: {servers.length}</h2>
            <ul>
                {servers.map((host) => (
                    <li key={host}>
                        <a
                            href="#"
                            onClick={() => {
                                sendCommand(`home ; whereis --goto  ${host}`);
                                globalThis.setTimeout(() => sendCommand("backdoor"), 500);
                            }}
                            style={{ color: theme.success }}
                        >
                            {host}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
