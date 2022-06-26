import { walkNetworkBFS } from "./walk-network.js";
const scripts = {
    'grow': '/batch/grow.js',
    'hack': '/batch/hack.js',
    'weaken': '/batch/weaken.js'
};
const scriptList = [scripts.grow, scripts.hack, scripts.weaken];
export async function main(ns) {
    let network = walkNetworkBFS(ns);
    let hostNames = Array.from(network.keys()).filter(h => h !== 'home');
    // Deploy all batch scripts to all servers
    for (const host of hostNames) {
        await ns.scp(scriptList, host);
    }
    let hosts = hostNames.map(h => ns.getServer(h));
    ns.run('/batch/manage.js', 1, JSON.stringify(hosts));
}
