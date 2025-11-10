import { parseFlags } from 'util/flags';
import { useNsUpdate, useTheme } from 'ui/hooks';
import { canInstallBackdoor, needsBackdoor } from 'util/backdoor';
import { FACTION_SERVERS } from 'util/faction-servers';
import { sendTerminalCommand } from 'util/terminal';
import { walkNetworkBFS } from 'util/walk';
import { React } from 'lib/react';
export async function main(ns) {
    await parseFlags(ns, []);
    ns.disableLog('ALL');
    ns.clearLog();
    ns.printRaw(React.createElement(BackdoorNotifier, { ns: ns }));
    ns.ui.renderTail();
    const tailOpen = { current: false };
    // keep the script alive so React effects continue to run
    while (true) {
        const { factionMissing } = backdoorableServers(ns);
        if (factionMissing.length > 0 && !tailOpen.current) {
            tailOpen.current = true;
            ns.ui.openTail();
        }
        else if (factionMissing.length === 0 && tailOpen.current) {
            tailOpen.current = false;
            ns.ui.closeTail();
        }
        await ns.asleep(1_000);
    }
}
function BackdoorNotifier({ ns }) {
    const theme = useTheme(ns);
    const { missing: servers, factionMissing: factionServers } = useNsUpdate(ns, 1000, backdoorableServers);
    return (React.createElement(React.Fragment, null,
        React.createElement(ServerDisplay, { ns: ns, title: 'Faction Servers', servers: factionServers, theme: theme }),
        React.createElement(ServerDisplay, { ns: ns, title: 'Servers', servers: servers, theme: theme })));
}
function ServerDisplay({ ns, title, servers, theme }) {
    return (React.createElement("div", null,
        React.createElement("h2", null,
            title,
            " missing backdoors: ",
            servers.length),
        React.createElement("ul", null, servers.map((host) => (React.createElement("li", { key: host },
            React.createElement("a", { href: "#", onClick: () => void backdoorHost(ns, host), style: { color: theme.success } }, host)))))));
}
async function backdoorHost(ns, host) {
    try {
        await sendTerminalCommand(ns, `home ; whereis --goto  ${host}`);
        await sendTerminalCommand(ns, 'backdoor');
    }
    catch (err) {
        ns.tprintf('failed to backdoor %s: %s', host, String(err));
    }
}
function backdoorableServers(ns) {
    const factionMissing = [];
    for (const host of FACTION_SERVERS) {
        const info = ns.getServer(host);
        if (needsBackdoor(info) && canInstallBackdoor(ns, info)) {
            factionMissing.push(host);
        }
    }
    const network = walkNetworkBFS(ns);
    const missing = [];
    for (const host of network.keys()) {
        const info = ns.getServer(host);
        if (!FACTION_SERVERS.includes(host)
            && needsBackdoor(info)
            && canInstallBackdoor(ns, info)) {
            missing.push(host);
        }
    }
    return { factionMissing, missing };
}
