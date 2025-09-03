import { expect, test } from '@jest/globals';

import { createPortsFixture } from '../nsPortFixture';

test('lazy, shared ports + nextWrite semantics', async () => {
    const portsFixture = createPortsFixture({ capacityPerPort: 2 });
    const getPortHandle = portsFixture.port;

    const a1 = getPortHandle(1);
    const a2 = getPortHandle(1);
    expect(a1).toBe(a2); // same instance

    const p = getPortHandle(2);
    expect(a1).not.toBe(p); // Different port numbers are different instances

    // nextWrite waits for the *next* write after it’s called
    const waiter = p.nextWrite();
    p.write('x');
    await expect(waiter).resolves.toBeUndefined();

    // capacity behavior
    a1.write('v1');
    a1.write('v2'); // capacity now full (2)
    const evicted = a1.write('v3'); // evicts 'v1'
    expect(evicted).toBe('v1');
    expect(a1.read()).toBe('v2');
    expect(a1.read()).toBe('v3');
    expect(a1.read()).toBe('NULL PORT DATA');
});
