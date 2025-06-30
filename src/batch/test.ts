import type { NS } from "netscript";
import { MemoryClient, TransferableAllocation } from "services/client/memory";
import { calculateWeakenThreads } from "batch/till";
import { calculateSowThreads } from "batch/sow";

function canUseFormulas(ns: NS): boolean {
    return ns.fileExists("Formulas.exe", "home");
}

interface Prediction {
    money: number;
    sec: number;
}

async function runScript(
    ns: NS,
    allocation: TransferableAllocation,
    script: string,
    threads: number,
    target: string,
): Promise<void> {
    for (const chunk of allocation.allocatedChunks) {
        if (threads <= 0) break;
        const t = Math.min(chunk.numChunks, threads);
        ns.scp(script, chunk.hostname, "home");
        const pid = ns.exec(script, chunk.hostname, t, target, 0);
        if (!pid) ns.tprintf(`failed to exec %s on %s`, script, chunk.hostname);
        while (ns.isRunning(pid)) {
            await ns.sleep(50);
        }
        threads -= t;
    }
}

function predictHackBuiltIn(ns: NS, target: string, threads: number, applyMults: boolean): Prediction {
    const maxMoney = ns.getServerMaxMoney(target);
    const mult = applyMults ? ns.getHackingMultipliers().money : 1;
    const percent = ns.hackAnalyze(target) * threads * mult;
    const money = -percent * maxMoney;
    const sec = ns.hackAnalyzeSecurity(threads, target);
    return { money, sec };
}

function predictHackFormula(ns: NS, target: string, threads: number, applyMults: boolean): Prediction {
    const server = ns.getServer(target);
    const player = ns.getPlayer();
    const mult = applyMults ? ns.getHackingMultipliers().money : 1;
    const percent = ns.formulas.hacking.hackPercent(server, player) * threads * mult;
    const money = -percent * server.moneyMax;
    const sec = ns.hackAnalyzeSecurity(threads, target);
    return { money, sec };
}

function growMultiplierForThreads(ns: NS, target: string, threads: number, applyMults: boolean): number {
    const growthMult = applyMults ? ns.getHackingMultipliers().growth : 1;
    let adjustedThreads = threads * growthMult;
    let low = 1;
    let high = 2;
    while (ns.growthAnalyze(target, high) < adjustedThreads) {
        low = high;
        high *= 2;
    }
    for (let i = 0; i < 20; i++) {
        const mid = (low + high) / 2;
        if (ns.growthAnalyze(target, mid) > adjustedThreads) {
            high = mid;
        } else {
            low = mid;
        }
    }
    return (low + high) / 2;
}

function predictGrowBuiltIn(ns: NS, target: string, threads: number, applyMults: boolean): Prediction {
    const startMoney = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);
    const mult = growMultiplierForThreads(ns, target, threads, applyMults);
    const moneyAfter = Math.min(maxMoney, startMoney * mult);
    const money = moneyAfter - startMoney;
    const sec = ns.growthAnalyzeSecurity(threads, target);
    return { money, sec };
}

function predictGrowFormula(ns: NS, target: string, threads: number, applyMults: boolean): Prediction {
    const server = ns.getServer(target);
    const player = ns.getPlayer();
    const mult = applyMults ? ns.getHackingMultipliers().growth : 1;
    server.moneyAvailable = ns.getServerMoneyAvailable(target);
    const moneyAfter = ns.formulas.hacking.growAmount(server, player, threads) * mult;
    const money = moneyAfter - server.moneyAvailable;
    const sec = ns.growthAnalyzeSecurity(threads, target);
    return { money, sec };
}

function predictWeaken(ns: NS, threads: number): Prediction {
    const sec = -ns.weakenAnalyze(threads);
    return { money: 0, sec };
}

async function resetServer(ns: NS, target: string, allocation: TransferableAllocation, maxThreads: number) {
    let wThreads = calculateWeakenThreads(ns, target);
    while (wThreads > 0) {
        const t = Math.min(maxThreads, wThreads);
        await runScript(ns, allocation, "/batch/w.js", t, target);
        wThreads -= t;
    }
    const { growThreads, weakenThreads } = calculateSowThreads(ns, target);
    let g = growThreads;
    while (g > 0) {
        const t = Math.min(maxThreads, g);
        await runScript(ns, allocation, "/batch/g.js", t, target);
        g -= t;
    }
    let w = weakenThreads;
    while (w > 0) {
        const t = Math.min(maxThreads, w);
        await runScript(ns, allocation, "/batch/w.js", t, target);
        w -= t;
    }
}

export async function main(ns: NS) {
    ns.disableLog("ALL");
    const flags = ns.flags([
        ["iterations", 5],
        ["max-threads", 1],
        ["help", false],
    ]);
    const rest = flags._ as string[];
    if (rest.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} TARGET [options]

Test predicted vs actual hack, grow, and weaken effects on TARGET.
Results are written in CSV format to resultsHack.txt, resultsGrow.txt and resultsWeaken.txt.

OPTIONS
  --help              Show this help message
  --iterations        Number of iterations to average (default 5)
  --max-threads       Max threads for tests (default 1)
`);
        return;
    }
    const target = rest[0];
    if (typeof target !== "string" || !ns.serverExists(target)) {
        ns.tprintf("target %s does not exist", target);
        return;
    }

    const iterations = flags["iterations"];
    if (typeof iterations !== "number" || iterations < 1) {
        ns.tprint("--iterations must be a positive integer");
        return;
    }

    const maxThreads = flags["max-threads"];
    if (typeof maxThreads !== "number" || maxThreads < 1) {
        ns.tprint("--max-threads must be a positive integer");
        return;
    }

    const useFormulas = canUseFormulas(ns);
    const applyMults = true;

    const client = new MemoryClient(ns);

    // The h script is slightly smaller than w or g
    const ram = ns.getScriptRam("/batch/w.js", "home");
    const allocation = await client.requestTransferableAllocation(ram, maxThreads * 10, true);
    if (!allocation) {
        ns.tprint("ERROR: failed to allocate memory");
        return;
    }

    for (let threads = 1; threads <= maxThreads; threads++) {
        for (let i = 0; i < iterations; i++) {
            await resetServer(ns, target, allocation, maxThreads);
            const beforeM = ns.getServerMoneyAvailable(target);
            const beforeS = ns.getServerSecurityLevel(target);
            const predHBI = predictHackBuiltIn(ns, target, threads, applyMults);
            const predHF = useFormulas ? predictHackFormula(ns, target, threads, applyMults) : { money: NaN, sec: NaN };
            await runScript(ns, allocation, "/batch/h.js", threads, target);
            const afterM = ns.getServerMoneyAvailable(target);
            const afterS = ns.getServerSecurityLevel(target);
            const data = [
                threads,
                (afterM - beforeM).toFixed(2),
                (afterS - beforeS).toFixed(3),
                predHBI.money.toFixed(2),
                predHBI.sec.toFixed(3),
                predHF.money.toFixed(2),
                predHF.sec.toFixed(3),
            ].join(",");
            ns.write("resultsHack.txt", data + "\n", "a");

            await resetServer(ns, target, allocation, maxThreads);
            const gBeforeM = ns.getServerMoneyAvailable(target);
            const gBeforeS = ns.getServerSecurityLevel(target);
            const predGBI = predictGrowBuiltIn(ns, target, threads, applyMults);
            const predGF = useFormulas ? predictGrowFormula(ns, target, threads, applyMults) : { money: NaN, sec: NaN };
            await runScript(ns, allocation, "/batch/g.js", threads, target);
            const gAfterM = ns.getServerMoneyAvailable(target);
            const gAfterS = ns.getServerSecurityLevel(target);
            const dataG = [
                threads,
                (gAfterM - gBeforeM).toFixed(2),
                (gAfterS - gBeforeS).toFixed(3),
                predGBI.money.toFixed(2),
                predGBI.sec.toFixed(3),
                predGF.money.toFixed(2),
                predGF.sec.toFixed(3),
            ].join(",");
            ns.write("resultsGrow.txt", dataG + "\n", "a");

            await resetServer(ns, target, allocation, maxThreads);
            const wBeforeM = ns.getServerMoneyAvailable(target);
            const wBeforeS = ns.getServerSecurityLevel(target);
            const predW = predictWeaken(ns, threads);
            await runScript(ns, allocation, "/batch/w.js", threads, target);
            const wAfterM = ns.getServerMoneyAvailable(target);
            const wAfterS = ns.getServerSecurityLevel(target);
            const dataW = [
                threads,
                (wAfterM - wBeforeM).toFixed(2),
                (wAfterS - wBeforeS).toFixed(3),
                predW.money.toFixed(2),
                predW.sec.toFixed(3),
            ].join(",");
            ns.write("resultsWeaken.txt", dataW + "\n", "a");
        }
    }

    await allocation.release(ns);
}
