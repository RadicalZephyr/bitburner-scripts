/* Find All Valid Math Expressions

You are given the following string which contains only digits between
0 and 9:

29787

You are also given a target number of -8. Return all possible ways you
can add the +(add), -(subtract), and *(multiply) operators to the
string such that it evaluates to the target number. (Normal order of
operations applies.)

The provided answer should be an array of strings containing the valid
expressions. The data provided by this problem is an array with two
elements. The first element is the string of digits, while the second
element is the target number:

["29787", -8]

NOTE: The order of evaluation expects script operator precedence NOTE:
Numbers in the expression cannot have leading 0's. In other words,
"1+01" is not a valid expression Examples:

Input: digits = "123", target = 6
Output: ["1+2+3", "1*2*3"]

Input: digits = "105", target = 5
Output: ["1*0+5", "10-5"]
 */

import type { NS } from "netscript";

export async function main(ns: NS) {
    let scriptName = ns.getScriptName();
    let contractPortNum = ns.args[0];
    if (typeof contractPortNum !== 'number') {
        ns.tprintf('%s contract run with non-number answer port argument', scriptName);
        return;
    }
    let contractDataJSON = ns.args[1];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string data argument. Must be a JSON string containing file, host and contract data.', scriptName);
        return;
    }
    let contractData: any = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    let answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

function solve(data: any): any {
    return null;
}
