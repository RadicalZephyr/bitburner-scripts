export const EMPTY_SENTINEL = "NULL PORT DATA";
export const DONE_SENTINEL = "PORT CLOSED";
export function* readAllFromPort(ns, port) {
    while (true) {
        let nextMsg = port.read();
        if (typeof nextMsg === "string" && (nextMsg === EMPTY_SENTINEL || nextMsg === DONE_SENTINEL)) {
            return;
        }
        yield nextMsg;
    }
}
