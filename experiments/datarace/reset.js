const PORT_DATA = 99; // channel under test
export function main(ns) {
    const data = ns.getPortHandle(PORT_DATA);
    data.write(1);
    return Promise.resolve();
}
