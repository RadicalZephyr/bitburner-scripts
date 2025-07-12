import { StatTracker, Condition } from "util/stat-tracker";

type Example = { a: number; b: string; c: number };

function makeExample(a: number, b: string = "x", c: number = 0): Example {
    return { a, b, c };
}

test('update only records numeric fields', () => {
    const tracker = new StatTracker<Example>();
    tracker.update(makeExample(1, 'hello', 2));

    expect(tracker.history.length).toBe(1);
    const entry = tracker.history[0];
    expect(entry.a).toBe(1);
    expect(entry.c).toBe(2);
    expect((entry as any).b).toBeUndefined();
    expect(typeof entry.t).toBe('number');
});

test('history length is capped', () => {
    const tracker = new StatTracker<Example>(2);
    tracker.update(makeExample(1));
    tracker.update(makeExample(2));
    tracker.update(makeExample(3));

    expect(tracker.history.length).toBe(2);
    expect(tracker.history[0].a).toBe(2);
    expect(tracker.history[1].a).toBe(3);
});

test('when resolves for greater than condition', async () => {
    const tracker = new StatTracker<Example>();
    const promise = tracker.when('a', Condition.GreaterThan, 5);

    tracker.update(makeExample(3));
    expect(tracker.listeners.length).toBe(1);

    tracker.update(makeExample(6));
    await expect(promise).resolves.toBe(6);
    expect(tracker.listeners.length).toBe(0);
});

test('when resolves for less than condition', async () => {
    const tracker = new StatTracker<Example>();
    const promise = tracker.when('a', Condition.LessThan, 5);

    tracker.update(makeExample(7));
    tracker.update(makeExample(3));

    await expect(promise).resolves.toBe(3);
});

test('whenVelocity resolves for greater than condition', async () => {
    const tracker = new StatTracker<Example>();
    const promise = tracker.whenVelocity('a', Condition.GreaterThan, 5);

    tracker.update(makeExample(0), 0);
    tracker.update(makeExample(0), 500);
    expect(tracker.velocityListeners.length).toBe(1);

    tracker.update(makeExample(10), 1000);

    await expect(promise).resolves.toBeCloseTo(10);
    expect(tracker.velocityListeners.length).toBe(0);
});

test('whenVelocity resolves for less than condition', async () => {
    const tracker = new StatTracker<Example>();
    const promise = tracker.whenVelocity('a', Condition.LessThan, 5);

    tracker.update(makeExample(0), 0);
    tracker.update(makeExample(10), 500);
    expect(tracker.velocityListeners.length).toBe(1);

    tracker.update(makeExample(10), 1000);
    tracker.update(makeExample(10), 1500);

    await expect(promise).resolves.toBeCloseTo(0);
    expect(tracker.velocityListeners.length).toBe(0);
});


test('threshold can be updated', async () => {
    const tracker = new StatTracker<Example>();
    let threshold = 5;
    const promise = tracker.when('a', Condition.LessThan, () => threshold);

    tracker.update(makeExample(7));
    expect(tracker.listeners.length).toBe(1);
    threshold = 2;

    tracker.update(makeExample(3));
    expect(tracker.listeners.length).toBe(1);

    tracker.update(makeExample(1));
    expect(tracker.listeners.length).toBe(0);

    await expect(promise).resolves.toBe(1);
});
