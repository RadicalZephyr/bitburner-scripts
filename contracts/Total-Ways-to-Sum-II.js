/* Total Ways to Sum II

How many different distinct ways can the number 21 be written as a sum
of integers contained in the set:

[1,4,5,6,7,8,9,13]?

You may use each integer in the set zero or more times.
 */
import { parseFlags } from 'util/flags';
import { isArrayOf, isNumber, isTuple } from 'util/validate';
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
const isContractData = isTuple(isNumber, isArrayOf(isNumber));
export function solve(data) {
    const [target, nums] = data;
    nums.sort((a, b) => a - b);
    const dp = Array(target + 1).fill(0);
    dp[0] = 1;
    for (const num of nums) {
        for (let i = num; i <= target; i++) {
            dp[i] += dp[i - num];
        }
    }
    return dp[target];
}
