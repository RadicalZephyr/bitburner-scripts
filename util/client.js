export class Client {
    ns;
    sendPort;
    receivePort;
    constructor(ns, sendPort, receivePort) {
        this.ns = ns;
        this.sendPort = ns.getPortHandle(sendPort);
        this.receivePort = ns.getPortHandle(receivePort);
    }
    trySendMessage(type, payload) {
        return trySendMessage(this.sendPort, type, payload);
    }
    async sendMessage(type, payload, pollPeriod) {
        return await sendMessage(this.ns, this.sendPort, type, payload, pollPeriod);
    }
    async sendMessageReceiveResponse(type, payload, pollPeriod) {
        return await sendMessageReceiveResponse(this.ns, this.sendPort, this.receivePort, type, payload, pollPeriod);
    }
}
export function trySendMessage(sendPort, type, payload) {
    const message = [type, null, payload];
    return sendPort.tryWrite(message);
}
export async function sendMessage(ns, sendPort, type, payload, pollPeriod) {
    const _pollPeriod = pollPeriod ?? 100;
    const message = [type, null, payload];
    while (!sendPort.tryWrite(message)) {
        await ns.sleep(_pollPeriod);
    }
}
export async function sendMessageReceiveResponse(ns, sendPort, receivePort, type, payload, pollPeriod) {
    const _pollPeriod = pollPeriod ?? 100;
    const requestId = makeReqId(ns);
    const message = [type, requestId, payload];
    while (!sendPort.tryWrite(message)) {
        await ns.sleep(_pollPeriod);
    }
    while (true) {
        // Check if port is empty, if so we can wait until nextWrite
        if (receivePort.empty())
            await receivePort.nextWrite();
        // Otherwise it has messages, so spin until it's empty
        // checking for our requestId. If our requestId isn't the
        // first message, then it's probably coming later and other
        // client's messages are before it in the port.
        while (!receivePort.empty()) {
            let nextMessage = receivePort.peek();
            if (nextMessage[0] === requestId) {
                // N.B. Important to pop our message from the port so
                // other messages can be processed!
                receivePort.read();
                return nextMessage[1];
            }
            await ns.sleep(_pollPeriod);
        }
    }
}
function makeReqId(ns) {
    const pid = ns.pid;
    const ts = Date.now();
    const r = Math.floor(Math.random() * 1e6);
    return `${pid}-${ts}-${r}`;
}
