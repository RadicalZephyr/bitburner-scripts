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

import type { NS } from "netscript";
import type { ContractData } from '../contract-locations';

export async function main(ns: NS) {
    let contractDataJSON = ns.args[0];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string argument. Must be a JSON string containing file, host and contract data.');
        return;
    }
    let contractData: ContractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
}
