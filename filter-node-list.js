/** @param {NS} ns */
export async function main(ns) {
        let allHosts = ns.read("allHosts.txt").split(",");
        let myHosts = new Set(ns.getPurchasedServers());
        myHosts.add("home");
        let foreignHosts = allHosts.filter(host => !myHosts.has(host));
        ns.write("foreignHosts.txt", foreignHosts);
}
