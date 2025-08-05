import type { NS, NetscriptPort } from 'netscript';
import { expect, test } from '@jest/globals';

import { calculateCheckInterval } from 'services/purchase_servers';
import {
    MessageType,
    ServerPurchaseClient,
} from 'services/client/server_purchase';

function makeNS(tryWrite: jest.Mock): NS {
    const port: NetscriptPort = {
        tryWrite,
        read: () => null,
        peek: () => null,
        clear: () => undefined,
        empty: () => true,
        nextWrite: async () => undefined,
    } as unknown as NetscriptPort;
    return {
        getPortHandle: () => port,
    } as unknown as NS;
}

test('client sends typed messages', () => {
    const tryWrite = jest.fn().mockReturnValue(true);
    const ns = makeNS(tryWrite);
    const client = new ServerPurchaseClient(ns);
    client.buy();
    client.setUrgency(50);
    expect(tryWrite).toHaveBeenNthCalledWith(1, [
        MessageType.BuyOrder,
        null,
        { state: true },
    ]);
    expect(tryWrite).toHaveBeenNthCalledWith(2, [
        MessageType.SetUrgency,
        null,
        { urgency: 50 },
    ]);
});

test('urgency scales check interval', () => {
    expect(calculateCheckInterval(1000, 50)).toBe(2000);
    expect(calculateCheckInterval(1000, 100)).toBe(1000);
});
