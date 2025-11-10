import { parseFlags } from 'util/flags';
export async function main(ns) {
    await parseFlags(ns, []);
    const contractTypes = ns.codingcontract
        .getContractTypes()
        .map((contractType) => {
        return contractType.replace(':', '').replaceAll(' ', '-');
    });
    ns.tprintf('%s', JSON.stringify(contractTypes));
    ns.write('contract-types.txt', JSON.stringify(contractTypes), 'w');
}
