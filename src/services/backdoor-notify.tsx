import type { NS, UserInterfaceTheme } from 'netscript';
import { parseFlags } from 'util/flags';

import { canInstallBackdoor, needsBackdoor } from 'util/backdoor';
import { sendTerminalCommand } from 'util/terminal';
import { useTheme } from 'util/useTheme';
import { useNsUpdate } from 'util/useNsUpdate';
import { walkNetworkBFS } from 'util/walk';

const FACTION_SERVERS = [
    'CSEC',
    'avmnite-02h',
    'I.I.I.I',
    'run4theh111z',
    'The-Cave',
];

export async function main(ns: NS) {
    await parseFlags(ns, []);

    ns.disableLog('ALL');
    ns.clearLog();

    ns.printRaw(<BackdoorNotifier ns={ns} />);
    ns.ui.renderTail();

    const tailOpen = { current: false };

    // keep the script alive so React effects continue to run
    while (true) {
        const { factionMissing } = backdoorableServers(ns);
        if (factionMissing.length > 0 && !tailOpen.current) {
            tailOpen.current = true;
            ns.ui.openTail();
        } else if (factionMissing.length === 0 && tailOpen.current) {
            tailOpen.current = false;
            ns.ui.closeTail();
        }

        await ns.asleep(1_000);
    }
}

interface BackdoorNotifierProps {
    ns: NS;
}

function BackdoorNotifier({ ns }: BackdoorNotifierProps) {
    const theme = useTheme(ns);

    const { missing: servers, factionMissing: factionServers } = useNsUpdate(
        ns,
        1000,
        backdoorableServers,
    );

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
                            onClick={async () => {
                                await sendTerminalCommand(
                                    `home ; whereis --goto  ${host}`,
                                );
                                globalThis.setTimeout(
                                    () => sendTerminalCommand('backdoor'),
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

function backdoorableServers(ns: NS) {
    const factionMissing: string[] = [];
    for (const host of FACTION_SERVERS) {
        const info = ns.getServer(host);
        if (needsBackdoor(info) && canInstallBackdoor(ns, info)) {
            factionMissing.push(host);
        }
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

    return { factionMissing, missing };
}
