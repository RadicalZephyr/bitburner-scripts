/** @param {NS} ns */
export async function main(ns) {
        let host = ns.args[0];
        let nearby = ns.scan(host);
        ns.tprint(
                "found ", nearby.length,
                " nodes near ", host, "\n",
                nearby
        );
}
