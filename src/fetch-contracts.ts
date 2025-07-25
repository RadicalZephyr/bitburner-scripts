import type { AutocompleteData, NS } from 'netscript';
import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';
import type { ContractData } from 'all-contracts';

import { walkNetworkBFS } from 'util/walk';

const ALL_CONTRACT_TYPES = [
    'Algorithmic-Stock-Trader-I',
    'Algorithmic-Stock-Trader-II',
    'Algorithmic-Stock-Trader-III',
    'Algorithmic-Stock-Trader-IV',
    'Array-Jumping-Game-II',
    'Array-Jumping-Game',
    'Compression-I-RLE-Compression',
    'Compression-II-LZ-Decompression',
    'Compression-III-LZ-Compression',
    'Encryption-I-Caesar-Cipher',
    'Encryption-II-Vigenère-Cipher',
    'Find-All-Valid-Math-Expressions',
    'Find-Largest-Prime-Factor',
    'Generate-IP-Addresses',
    'HammingCodes-Encoded-Binary-to-Integer',
    'HammingCodes-Integer-to-Encoded-Binary',
    'Merge-Overlapping-Intervals',
    'Minimum-Path-Sum-in-a-Triangle',
    'Proper-2-Coloring-of-a-Graph',
    'Sanitize-Parentheses-in-Expression',
    'Shortest-Path-in-a-Grid',
    'Spiralize-Matrix',
    'Square-Root',
    'Subarray-with-Maximum-Sum',
    'Total-Ways-to-Sum',
    'Total-Ways-to-Sum-II',
    'Unique-Paths-in-a-Grid-II',
    'Unique-Paths-in-a-Grid-I',
];

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    if (
        args[args.length - 1] === '--test'
        || args[args.length - 2] === '--test'
    ) {
        return ALL_CONTRACT_TYPES;
    } else {
        return [];
    }
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['test', null],
        ['count', -1],
        ['help', false],
        ...MEM_TAG_FLAGS,
    ]);

    if (
        flags.help
        || (flags.test !== null && typeof flags.test != 'string')
        || (flags.count !== -1 && typeof flags.count !== 'number')
    ) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} [--test CONTRACT_NAME]

OPTIONS
  --help                Show this help message
  --test CONTRACT_NAME  Test a specific contract type
  --count N             Only process N contracts
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    const network = walkNetworkBFS(ns);
    const allHosts = Array.from(network.keys());

    const contractPortNum = 266; // "CON"
    const contractFile = /\.cct/;

    const contractPort = ns.getPortHandle(contractPortNum);
    const contracts: ContractData[] = [];

    const incompleteScriptContracts = [];
    const missingScriptContracts = [];

    let count = 0;

    outer: for (const host of allHosts) {
        if (host == 'home') {
            continue;
        }

        const files = ns.ls(host).filter((file) => contractFile.test(file));
        for (const file of files) {
            const contractType = ns.codingcontract
                .getContractType(file, host)
                .replace(':', '')
                .replaceAll(' ', '-');

            if (flags.test !== null && flags.test !== contractType) {
                continue;
            }

            const data = ns.codingcontract.getData(file, host);
            const dataJson = JSON.stringify(data, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value,
            );

            const contract: ContractData = {
                type: contractType,
                file: file,
                host: host,
                data: dataJson,
                answer: null,
            };

            let contractScriptName = ns.sprintf(
                '/contracts/%s.js',
                contractType,
            );
            if (!ns.fileExists(contractScriptName)) {
                const incompleteContractScriptName = ns.sprintf(
                    '/contracts/incomplete/%s.js',
                    contractType,
                );
                if (ns.fileExists(incompleteContractScriptName)) {
                    incompleteScriptContracts.push(contract);

                    if (flags.test !== null) {
                        contractScriptName = incompleteContractScriptName;
                    } else {
                        // Skip running the contract if not in test
                        // mode for this contract type.
                        continue;
                    }
                } else {
                    missingScriptContracts.push(contract);
                    // Script is missing, always skip running it
                    // because it would fail.
                    continue;
                }
            }

            const pid = ns.run(
                contractScriptName,
                1,
                contractPortNum,
                dataJson,
            );
            if (pid === 0) {
                ns.tprintf(
                    'failed to run script for contract %s from host %s',
                    contractType,
                    contract['host'],
                );
            }

            // Wait until the contract solver script finishes.
            while (true) {
                await ns.sleep(100);
                if (!ns.isRunning(pid)) {
                    break;
                }
            }

            contract.answer = contractPort.read();

            contracts.push(contract);

            if (flags.test !== null && flags.count !== null) {
                count += 1;

                if (count >= (flags.count as number)) {
                    break outer;
                }
            }
        }
    }
    const incompleteContractTypes = [
        ...new Set(incompleteScriptContracts.map((c) => c.type)),
    ];
    if (incompleteContractTypes.length > 0) {
        incompleteContractTypes.sort();
        ns.tprintf(
            '\ncontracts with an incomplete solution: %s',
            JSON.stringify(incompleteContractTypes, null, 2),
        );
    }

    if (missingScriptContracts.length > 0) {
        ns.tprintf('\nNo scripts found for the following contracts:');
        for (const c of missingScriptContracts) {
            ns.tprintf(
                ' type %s contract %s from host %s',
                c.file,
                c.type,
                c.host,
            );
        }
    }

    const allContractsFile = 'all-contracts.js';
    const fileData = ns.sprintf(
        'export let CONTRACTS = %s;',
        JSON.stringify(contracts, null, 2),
    );
    ns.write(allContractsFile, fileData, 'w');
}
