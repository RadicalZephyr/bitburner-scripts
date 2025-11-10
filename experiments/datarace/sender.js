const PORT_SYNC = 98;
const PORT_DATA = 99;
export async function main(ns) {
    const sync = ns.getPortHandle(PORT_SYNC);
    const data = ns.getPortHandle(PORT_DATA);
    while (true) {
        if (sync.empty()) {
            await sync.nextWrite();
        }
        const token = sync.read();
        // Write immediately to maximize chance of landing in the race window
        data.write(token);
    }
}
