import type { NS, Server, UserInterfaceTheme } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { walkNetworkBFS } from 'util/walk';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const React: any;

const FACTION_SERVERS = [
    'CSEC',
    'avmnite-02h',
    'I.I.I.I',
    'run4theh111z',
    'The-Cave',
];

interface BackdoorNotifierProps {
    ns: NS;
}

function BackdoorNotifier({ ns }: BackdoorNotifierProps) {
    const [factionServers, setFactionServers] = React.useState([] as string[]);
    const [servers, setServers] = React.useState([] as string[]);
    const [theme, setTheme] = React.useState(
        ns.ui.getTheme() as UserInterfaceTheme,
    );

    const tailOpen = React.useRef(false);

    React.useEffect(() => {
        const id = globalThis.setInterval(() => {
            const factionMissing: string[] = [];
            for (const host of FACTION_SERVERS) {
                const info = ns.getServer(host);
                if (needsBackdoor(info) && canInstallBackdoor(ns, info)) {
                    factionMissing.push(host);
                }
            }

            if (factionMissing.length > 0 && !tailOpen.current) {
                tailOpen.current = true;
                ns.ui.openTail();
            } else if (factionMissing.length === 0 && tailOpen.current) {
                tailOpen.current = false;
                ns.ui.closeTail();
            }

            const network = walkNetworkBFS(ns);
            const missing: string[] = [];
            for (const host of network.keys()) {
                const info = ns.getServer(host);
                if (
                    !FACTION_SERVERS.includes(host)
                    && needsBackdoor(info)
                    && canInstallBackdoor(ns, info)
                ) {
                    missing.push(host);
                }
            }

            setFactionServers(factionMissing);
            setServers(missing);
            setTheme(ns.ui.getTheme());
            ns.ui.renderTail();
        }, 200);

        return () => {
            globalThis.clearInterval(id);
        };
    }, [ns]);

    return (
        <>
            <ServerDisplay
                title={'Faction Servers'}
                servers={factionServers}
                theme={theme}
            />
            <ServerDisplay title={'Servers'} servers={servers} theme={theme} />
        </>
    );
}

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    ns.disableLog('ALL');
    ns.clearLog();

    ns.printRaw(<BackdoorNotifier ns={ns} />);
    ns.ui.renderTail();

    // keep the script alive so React effects continue to run
    while (true) {
        await ns.sleep(60_000);
    }
}

function needsBackdoor(info: Server) {
    return !(
        info.hostname === 'home'
        || info.purchasedByPlayer
        || info.backdoorInstalled
    );
}

function canInstallBackdoor(ns: NS, info: Server) {
    return ns.getHackingLevel() >= info.requiredHackingSkill;
}

/** Send a command to the terminal by simulating user input. */
export function sendCommand(command: string): void {
    const terminalInput = globalThis['terminal-input'];
    if (!(terminalInput instanceof HTMLInputElement)) return;

    terminalInput.value = command;
    const handler = Object.keys(terminalInput)[1];
    terminalInput[handler].onChange({ target: terminalInput });
    function enterKey() {
        terminalInput[handler].onKeyDown({
            key: 'Enter',
            preventDefault: (): void => null,
        });
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
            <h2>
                {title} missing backdoors: {servers.length}
            </h2>
            <ul>
                {servers.map((host) => (
                    <li key={host}>
                        <a
                            href="#"
                            onClick={() => {
                                sendCommand(`home ; whereis --goto  ${host}`);
                                globalThis.setTimeout(
                                    () => sendCommand('backdoor'),
                                    500,
                                );
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
