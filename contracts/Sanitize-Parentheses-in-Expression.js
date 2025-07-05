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
export async function main(ns) {
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
    let contractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    let answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}
function solve(data) {
    if (areParensBalanced(data)) {
        return [data];
    }
    let parenPositions = findParenPositions(data);
    let solutions = uniqueBalancedParens(data, parenPositions.map((x) => [x]));
    if (solutions.length > 0) {
        return solutions;
    }
    for (let m = 2; m < parenPositions.length; m++) {
        let idxChoices = [...choose(parenPositions, m)];
        let solutions = uniqueBalancedParens(data, idxChoices);
        if (solutions.length > 0) {
            return solutions;
        }
    }
    return [data.replaceAll(/[()]/g, "")];
}
function uniqueBalancedParens(data, idxChoices) {
    let balancedParens = idxChoices
        .map((is) => {
        is.sort((a, b) => b - a);
        let s = data.split('');
        for (const i of is) {
            s.splice(i, 1);
        }
        return s.join('');
    })
        .filter(s => areParensBalanced(s));
    let uniqueBalancedParens = new Set(balancedParens);
    return [...uniqueBalancedParens];
}
function findParenPositions(s) {
    return [...s.matchAll(/([()])/g)].map(m => m.index);
}
function areParensBalanced(s) {
    let count = 0;
    for (const c of s) {
        if (c === '(') {
            count += 1;
        }
        else if (c === ')') {
            count -= 1;
        }
        if (count < 0) {
            return false;
        }
    }
    return count === 0;
}
function* choose(a, m) {
    let n = a.length;
    let c = [];
    for (let i = 0; i != m; i++) {
        c.push(a[n - m + i]);
    }
    yield [...c];
    let p = initTwiddle(m, n);
    while (true) {
        let [done, x, _y, z] = twiddle(p);
        if (done) {
            return;
        }
        c[z] = a[x];
        yield [...c];
    }
}
function initTwiddle(m, n) {
    let p = [];
    p.push(n + 1);
    let i;
    for (i = 1; i != n - m + 1; i++) {
        p.push(0);
    }
    while (i != n + 1) {
        p.push(i + m - n);
        i++;
    }
    p.push(-2);
    if (m === 0) {
        p[1] = 1;
    }
    return p;
}
function twiddle(p) {
    let x, y, z;
    let done = false;
    let j = 1;
    while (p[j] <= 0) {
        j++;
    }
    if (p[j - 1] == 0) {
        let i;
        for (i = j - 1; i != 1; i--) {
            p[i] = -1;
        }
        p[j] = 0;
        x = z = 0;
        p[1] = 1;
        y = j - 1;
    }
    else {
        if (j > 1) {
            p[j - 1] = 0;
        }
        do {
            j++;
        } while (p[j] > 0);
        let k = j - 1;
        let i = j;
        while (p[i] == 0) {
            p[i++] = -1;
        }
        if (p[i] == -1) {
            p[i] = p[k];
            z = p[k] - 1;
            x = i - 1;
            y = k - 1;
            p[k] = -1;
        }
        else {
            if (i === p[0]) {
                done = true;
            }
            else {
                p[j] = p[i];
                z = p[i] - 1;
                p[i] = 0;
                x = j - 1;
                y = i - 1;
            }
        }
    }
    return [done, x, y, z];
}
