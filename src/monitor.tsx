import type { NS, UserInterfaceTheme } from "netscript";

import { ALL_HOSTS } from "all-hosts";


declare const React: any;

export async function main(ns: NS) {
    const flags = ns.flags([
        ['refreshrate', 200],
        ['help', false],
    ]);

    const rest = flags._ as string[];
    if (rest.length !== 0 || flags.help || typeof flags.refreshrate != 'number') {
        ns.tprint(`USAGE: run ${ns.getScriptName()}

        This script helps visualize the money and security of all servers.

        OPTIONS
        --refreshrate   Time to sleep between refreshing server data

        Example:

        > run ${ns.getScriptName()}
`);
        return;
    }
    ns.disableLog('ALL');
    ns.clearLog();
    ns.tail();
    ns.resizeTail(450, 30 * 6);

    let servers = ALL_HOSTS.filter(name => name !== "host");
    let theme = ns.ui.getTheme();

    while (true) {
        let serverInfo = servers.map(server => formatServerInfo(ns, server));
        ns.clearLog();
        ns.printRaw(<ServerTable ns={ns} servers={serverInfo} theme={theme}></ServerTable>);
        await ns.sleep(flags.refreshrate);
    }
}

interface ITableSettings {
    ns: NS
    servers: ServerData[]
    theme: UserInterfaceTheme
};


function ServerTable({ ns, servers, theme }: ITableSettings) {
    return (
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Money</th>
                    <th>Security</th>
                    <th>Hack</th>
                    <th>Grow</th>
                    <th>Weak</th>
                </tr>
            </thead>
            {servers.map(server => <ServerRow ns={ns} server={server}></ServerRow>)}
        </table>
    );
}

interface IServerSettings {
    ns: NS
    server: ServerData
};

function ServerRow({ ns, server }: IServerSettings) {
    return (
        <tr key={server.name}>
            <td>{server.name}</td>
            <td>{server.money}</td>
            <td>{server.security}</td>
            <td>{server.hack}</td>
            <td>{server.grow}</td>
            <td>{server.weaken}</td>
        </tr>
    );
}

type ServerData = {
    name: string
    money: string
    security: string
    hack: string
    grow: string
    weaken: string
};

function formatServerInfo(ns: NS, server: string): ServerData {
    let money = ns.getServerMoneyAvailable(server);
    let maxMoney = ns.getServerMaxMoney(server);
    let moneyPercent = (money / maxMoney * 100).toFixed(2);
    let minSec = ns.getServerMinSecurityLevel(server);
    let sec = ns.getServerSecurityLevel(server);
    return {
        name: server,
        money: `$${ns.formatNumber(money)} / $${ns.formatNumber(maxMoney)} (${moneyPercent})`,
        security: `+${(sec - minSec).toFixed(2)} (${sec.toFixed(2)} / ${minSec.toFixed(2)})`,
        hack: `${ns.tFormat(ns.getHackTime(server))} (t=${Math.ceil(ns.hackAnalyzeThreads(server, money))})`,
        grow: `${ns.tFormat(ns.getGrowTime(server))} (t=${buildAnalyze(ns, server, maxMoney / money)})`,
        weaken: `${ns.tFormat(ns.getWeakenTime(server))} (t=${softenThreads(sec - minSec)})`
    };
}

/** Calculate the number of threads to soften any server by the given amount.
 */
export function softenThreads(softenAmount) {
    // We multiply by 20 because 1 thread of weaken reduces security
    // by a fixed amount of 0.05, or 1/20
    return Math.ceil(softenAmount * 20);
}

/** Calculate the number of threads needed to build the server by a
 * certain multiplier.
 */
function buildAnalyze(ns, target, buildAmount) {
    if (buildAmount >= 1) {
        return Math.ceil(ns.growthAnalyze(target, buildAmount, 1));
    }
    else {
        return 0;
    }
}
