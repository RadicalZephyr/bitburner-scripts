/* Generate IP Addresses

Given the following string containing only digits, return an array
with all possible valid IP address combinations that can be created
from the string:

2261743611

Note that an octet cannot begin with a '0' unless the number itself is
actually 0. For example, '192.168.010.1' is not a valid IP.

Examples:

25525511135 -> ["255.255.11.135", "255.255.111.35"]
1938718066 -> ["193.87.180.66"]
 */
import { MEM_TAG_FLAGS } from "services/client/memory_tag";
export async function main(ns) {
    const flags = ns.flags(MEM_TAG_FLAGS);
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
export let data = "2261743611";
export function solve(data) {
    if (data.length < 4 || data.length > 12) {
        // Only strings between 4 and 12 characters can be valid Ip
        // Addresses
        return null;
    }
    let permutations = PERMUTATIONS[data.length - 4];
    return permutations.map(p => {
        let [[s1, e1], [s2, e2], [s3, e3], [s4, e4]] = p;
        let ip = [
            data.slice(s1, e1),
            data.slice(s2, e2),
            data.slice(s3, e3),
            data.slice(s4, e4),
        ];
        return ip;
    })
        .filter(ip => is_valid_ip(ip))
        .map(ip => format_ip(ip));
}
function is_valid_ip(ip) {
    for (const octet of ip) {
        if (octet.length > 1 && octet[0] === '0') {
            return false;
        }
        let octet_num = Number(octet);
        if (typeof octet_num !== "number" || octet_num < 0 || octet_num > 255) {
            return false;
        }
    }
    return true;
}
function format_ip(ip) {
    return ip.join('.');
}
const PERMUTATIONS = [
    /* 4: */ [[[0, 1], [1, 2], [2, 3], [3, 4]]],
    /* 5: */ [[[0, 1], [1, 2], [2, 3], [3, 5]], [[0, 2], [2, 3], [3, 4], [4, 5]], [[0, 1], [1, 2], [2, 4], [4, 5]], [[0, 1], [1, 3], [3, 4], [4, 5]]],
    /* 6: */ [[[0, 1], [1, 2], [2, 3], [3, 6]], [[0, 3], [3, 4], [4, 5], [5, 6]], [[0, 1], [1, 4], [4, 5], [5, 6]], [[0, 1], [1, 2], [2, 5], [5, 6]], [[0, 1], [1, 3], [3, 4], [4, 6]], [[0, 2], [2, 3], [3, 4], [4, 6]], [[0, 2], [2, 3], [3, 5], [5, 6]], [[0, 2], [2, 4], [4, 5], [5, 6]], [[0, 1], [1, 2], [2, 4], [4, 6]], [[0, 1], [1, 3], [3, 5], [5, 6]]],
    /* 7: */ [[[0, 2], [2, 4], [4, 5], [5, 7]], [[0, 2], [2, 4], [4, 6], [6, 7]], [[0, 3], [3, 5], [5, 6], [6, 7]], [[0, 2], [2, 5], [5, 6], [6, 7]], [[0, 3], [3, 4], [4, 5], [5, 7]], [[0, 1], [1, 4], [4, 5], [5, 7]], [[0, 1], [1, 2], [2, 4], [4, 7]], [[0, 3], [3, 4], [4, 6], [6, 7]], [[0, 1], [1, 3], [3, 6], [6, 7]], [[0, 2], [2, 3], [3, 4], [4, 7]], [[0, 1], [1, 4], [4, 6], [6, 7]], [[0, 2], [2, 3], [3, 6], [6, 7]], [[0, 2], [2, 3], [3, 5], [5, 7]], [[0, 1], [1, 3], [3, 4], [4, 7]], [[0, 1], [1, 3], [3, 5], [5, 7]], [[0, 1], [1, 2], [2, 5], [5, 7]]],
    /* 8: */ [[[0, 1], [1, 4], [4, 7], [7, 8]], [[0, 2], [2, 3], [3, 5], [5, 8]], [[0, 2], [2, 4], [4, 7], [7, 8]], [[0, 2], [2, 3], [3, 6], [6, 8]], [[0, 2], [2, 5], [5, 7], [7, 8]], [[0, 3], [3, 4], [4, 6], [6, 8]], [[0, 3], [3, 4], [4, 5], [5, 8]], [[0, 2], [2, 5], [5, 6], [6, 8]], [[0, 3], [3, 6], [6, 7], [7, 8]], [[0, 1], [1, 3], [3, 5], [5, 8]], [[0, 1], [1, 3], [3, 6], [6, 8]], [[0, 3], [3, 4], [4, 7], [7, 8]], [[0, 2], [2, 4], [4, 6], [6, 8]], [[0, 1], [1, 2], [2, 5], [5, 8]], [[0, 3], [3, 5], [5, 7], [7, 8]], [[0, 1], [1, 4], [4, 5], [5, 8]], [[0, 3], [3, 5], [5, 6], [6, 8]], [[0, 2], [2, 4], [4, 5], [5, 8]], [[0, 1], [1, 4], [4, 6], [6, 8]]],
    /* 9: */ [[[0, 2], [2, 4], [4, 7], [7, 9]], [[0, 2], [2, 3], [3, 6], [6, 9]], [[0, 2], [2, 5], [5, 7], [7, 9]], [[0, 3], [3, 5], [5, 8], [8, 9]], [[0, 1], [1, 4], [4, 6], [6, 9]], [[0, 3], [3, 5], [5, 6], [6, 9]], [[0, 1], [1, 4], [4, 7], [7, 9]], [[0, 3], [3, 6], [6, 8], [8, 9]], [[0, 1], [1, 3], [3, 6], [6, 9]], [[0, 3], [3, 6], [6, 7], [7, 9]], [[0, 2], [2, 5], [5, 6], [6, 9]], [[0, 3], [3, 4], [4, 7], [7, 9]], [[0, 2], [2, 5], [5, 8], [8, 9]], [[0, 3], [3, 5], [5, 7], [7, 9]], [[0, 2], [2, 4], [4, 6], [6, 9]], [[0, 3], [3, 4], [4, 6], [6, 9]]],
    /* 10: */ [[[0, 3], [3, 6], [6, 8], [8, 10]], [[0, 1], [1, 4], [4, 7], [7, 10]], [[0, 3], [3, 5], [5, 8], [8, 10]], [[0, 3], [3, 4], [4, 7], [7, 10]], [[0, 3], [3, 5], [5, 7], [7, 10]], [[0, 2], [2, 5], [5, 7], [7, 10]], [[0, 2], [2, 5], [5, 8], [8, 10]], [[0, 2], [2, 4], [4, 7], [7, 10]], [[0, 3], [3, 6], [6, 9], [9, 10]], [[0, 3], [3, 6], [6, 7], [7, 10]]],
    /* 11: */ [[[0, 3], [3, 6], [6, 9], [9, 11]], [[0, 3], [3, 6], [6, 8], [8, 11]], [[0, 2], [2, 5], [5, 8], [8, 11]], [[0, 3], [3, 5], [5, 8], [8, 11]]],
    /* 12: */ [[[0, 3], [3, 6], [6, 9], [9, 12]]],
];
