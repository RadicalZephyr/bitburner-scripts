/* Sanitize Parentheses in Expression

Given the following string:

```
((())((a -> ["(())a"]
```

remove the minimum number of invalid parentheses in order to validate
the string. If there are multiple minimal ways to validate the string,
provide all of the possible results. The answer should be provided as
an array of strings. If it is impossible to validate the string the
result should be an array with only an empty string.

IMPORTANT: The string may contain letters, not just parentheses. Examples:
```
"()())()" -> ["()()()", "(())()"]
"(a)())()" -> ["(a)()()", "(a())()"]
")(" -> [""]
```
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
