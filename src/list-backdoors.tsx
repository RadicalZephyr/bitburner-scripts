import type { NS, UserInterfaceTheme } from "netscript";

import { walkNetworkBFS } from "util/walk";

declare const React: any;

declare global {
    interface Global {
        document: any;
    }
    var globalThis: Global;
}

/** Send a command to the terminal by simulating user input. */
export function sendCommand(command: string): void {
    const terminalInput: any = globalThis.document.getElementById("terminal-input");
    terminalInput.value = command;
    const handler = Object.keys(terminalInput)[1];
    terminalInput[handler].onChange({ target: terminalInput });
    function enterKey() {
        terminalInput[handler].onKeyDown({ key: "Enter", preventDefault: (): void => null });
    }
    globalThis.setTimeout(enterKey, 10);
}


interface ServerDisplayProps {
    servers: string[];
    theme: UserInterfaceTheme;
}

function ServerDisplay({ servers, theme }: ServerDisplayProps) {
    return (
        <div>
            <h2>Servers missing backdoors: {servers.length}</h2>
            <ul>
                {servers.map((host) => (
                    <li key={host}>
                        <a
                            href="#"
                            onClick={() => sendCommand(`home ; whereis --goto  ${host}`)}
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

export async function main(ns: NS) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    while (true) {
        const network = walkNetworkBFS(ns);
        const missingBackdoor: string[] = [];

        for (const host of network.keys()) {
            const info = ns.getServer(host);
            if (!info.backdoorInstalled) {
                missingBackdoor.push(host);
            }
        }

        const theme = ns.ui.getTheme();
        ns.clearLog();
        ns.printRaw(<ServerDisplay servers={missingBackdoor} theme={theme}></ServerDisplay>);

        await ns.sleep(1000);
    }
}
