import { launch } from "services/launch";
export async function main(ns) {
    const tracker = await launch(ns, "/stock/tracker.js", {
        threads: 1,
        allocationFlag: "--allocation-id",
        dependencies: ns.ls("/stocks"),
    });
    await launch(ns, "/stock/trader.js", {
        threads: 1,
        allocationFlag: "--allocation-id",
    });
}
