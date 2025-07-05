export async function main(ns) {
    let contractTypes = ns.codingcontract.getContractTypes().map(contractType => {
        return contractType.replace(':', '').replaceAll(' ', '-');
    });
    ns.tprintf('%s', JSON.stringify(contractTypes));
    ns.write('contract-types.txt', JSON.stringify(contractTypes), 'w');
}
