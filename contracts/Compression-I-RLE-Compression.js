/* Compression I: RLE Compression

Run-length encoding (RLE) is a data compression technique which
encodes data as a series of runs of a repeated single character. Runs
are encoded as a length, followed by the character itself. Lengths are
encoded as a single ASCII digit; runs of 10 characters or more are
encoded by splitting them into multiple runs.

You are given the following input string:
    QQQQQQQQNXXXXXddW200bbhhhhhhhkkHHHHHuu77ii4GGGGGGGIk44hwwwwwwwwSSEIIIIIIIIrrr2DDppppppppppp6
Encode it using run-length encoding with the minimum possible output length.

Examples:
    aaaaabccc            ->  5a1b3c
    aAaAaA               ->  1a1A1a1A1a1A
    111112333            ->  511233
    zzzzzzzzzzzzzzzzzzz  ->  9z9z1z  (or 9z8z2z, etc.)
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
    ns.writePort(contractPortNum, answer);
}
export function solve(data) {
    let current = null;
    let currentLen = 0;
    let encoding = "";
    for (let i = 0; i < data.length; ++i) {
        if (data[i] === current) {
            currentLen += 1;
            if (currentLen == 10) {
                encoding += `${9}${current}`;
                currentLen = 1;
            }
        }
        else {
            if (current !== null) {
                encoding += `${currentLen}${current}`;
            }
            current = data[i];
            currentLen = 1;
        }
    }
    // Add encoding for the final run
    if (current !== null) {
        encoding += `${currentLen}${current}`;
    }
    return encoding;
}
