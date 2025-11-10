// Algorithmic Stock Trader II
import { parseFlags } from 'util/flags';
import { isArrayOf, isNumber } from 'util/validate';
export async function main(ns) {
    await parseFlags(ns, []);
    const scriptName = ns.getScriptName();
    const contractPortNum = ns.args[0];
    if (typeof contractPortNum !== 'number') {
        ns.tprintf('%s contract run with non-number answer port argument', scriptName);
        return;
    }
    const contractDataJSON = ns.args[1];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string data argument. Must be a JSON string containing file, host and contract data.', scriptName);
        return;
    }
    const contractData = JSON.parse(contractDataJSON);
    if (!isContractData(contractData)) {
        ns.writePort(contractPortNum, JSON.stringify(null));
        return;
    }
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    const answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}
const isContractData = isArrayOf(isNumber);
export function solve(data) {
    let profit = 0;
    for (let i = 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        if (diff > 0)
            profit += diff;
    }
    return profit;
}
