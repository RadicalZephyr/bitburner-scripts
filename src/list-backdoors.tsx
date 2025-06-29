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
    terminalInput[handler].onKeyDown({ key: "Enter", preventDefault: (): void => null });
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
                            onClick={() => sendCommand(`connect ${host}`)}
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
    ns.disableLog("sleep");

    const network = walkNetworkBFS(ns);
    const missingBackdoor: string[] = [];

    for (const host of network.keys()) {
        const info = ns.getServer(host);
        if (!info.backdoorInstalled) {
            missingBackdoor.push(host);
        }
        await ns.sleep(0);
    }

    const theme = ns.ui.getTheme();
    ns.clearLog();
    ns.printRaw(<ServerDisplay servers={missingBackdoor} theme={theme}></ServerDisplay>);
}
