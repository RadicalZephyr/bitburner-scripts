import type { NS } from "netscript";

import { walkNetworkBFS } from "./lib";

const CONTRACT_PORT: number = 20;

type Contract = {
    file: string,
    host: string,
    contract_name: string,
};

export async function main(ns: NS) {
    const network = walkNetworkBFS(ns);
    const allHosts = Array.from(network.keys());

    let contracts: Contract[] = [];

    for (const host of allHosts) {
        if (host == "home") continue;

        const localContracts = ns.ls(host, ".cct").map(f => {
            return {
                'file': f,
                'host': host,
                'contract_name': ns.codingcontract.getContractType(f, host)
            };
        });

        if (localContracts.length > 0) contracts.push(...localContracts);
    }

    for (const contract of contracts) {
        const programName = '/contracts/' + contract.contract_name.replaceAll(' ', '-') + '.js';

        if (!ns.fileExists(programName)) {
            ns.tprint(`Found unsolvable contract of type '${contract.contract_name}' in ${contract.file} on ${contract.host}
Create a script ${programName} to solve this contract type!\n
`);
            continue;
        }

        const contractData: number = ns.codingcontract.getData(contract.file, contract.host);
        const stringContractData = JSON.stringify(contractData);

        const pid = ns.run(programName, 1, stringContractData)
        if (pid === 0) {
            ns.tprint(`Could not run ${programName}, try running manually:
run ${programName} "${stringContractData}"
`);
            continue;
        }

        // Sleep until the solver script exits
        while (ns.getRunningScript(pid)) await ns.sleep(200);

        const contractPort = ns.getPortHandle(CONTRACT_PORT);
        // Get output from contract solving program
        let answer = contractPort.read();
        // If the port data isn't a valid answer then just skip this contract
        if (typeof answer == 'string' && answer === 'NULL PORT DATA') {
            ns.tprint(`
No answer received from ${programName}.
Program should write the answer to the contract to port ${CONTRACT_PORT}.
`);
            continue;
        }

        let contractAnswer: number | string[];
        if (typeof answer == 'string') {
            contractAnswer = [answer];
        } else {
            contractAnswer = answer;
        }

        // Attempt to submit it to the contract
        const contractReward = ns.codingcontract.attempt(contractAnswer, contract.file, contract.host);

        if (typeof contractReward == 'string') {
            if (contractReward === '') {
                ns.tprint(`
failed contract ${contract.contract_name}
puzzle data: ${stringContractData}
incorrect answer: ${contractAnswer}
`);
            } else {
                ns.tprint(`
solved ${contract.contract_name}
reward: ${contractReward}
`);
            }
        }
    }
}
