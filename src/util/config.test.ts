import { Config, ConfigInstance } from "./config";
import { LocalStorage, setLocalStorage } from "./localStorage";

let storage: Record<string, string> = {};

beforeEach(() => {
    storage = {};
    const ls: Storage = {
        get length() {
            return Object.keys(storage).length;
        },
        clear: () => { storage = {}; },
        key: (index: number) => Object.keys(storage)[index],
        getItem: (key: string) => storage[key],
        removeItem: (key: string) => { delete storage[key]; },
        setItem: (key: string, value: string) => { storage[key] = value; }
    };
    setLocalStorage(ls);
});

test('configs have default values', () => {
    const CONFIG_SPEC = [
        ["STRING", "/strings"],
        ["BOOLEAN", true],
        ["NUMBER", 5],
        ["BIGINT", 10n],
        ["OBJECT", { a: 1, b: "hello" }]
    ] as const;

    const ExampleConfig: ConfigInstance<typeof CONFIG_SPEC> = new Config("EXAMPLE", CONFIG_SPEC) as ConfigInstance<typeof CONFIG_SPEC>;

    expect(ExampleConfig.STRING).toBe("/strings");
    expect(ExampleConfig.BOOLEAN).toBe(true);
    expect(ExampleConfig.NUMBER).toBe(5);
    expect(ExampleConfig.BIGINT).toBe(10n);
    expect(ExampleConfig.OBJECT).toStrictEqual({ a: 1, b: "hello" });
});
