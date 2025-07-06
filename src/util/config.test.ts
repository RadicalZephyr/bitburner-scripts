import { Config, ConfigInstance } from "util/config";
import { setLocalStorage } from "util/localStorage";
import { assertEquals } from "https://deno.land/std/assert/mod.ts";


let storage: Record<string, string> = {};

function setup() {
    storage = {};
    const ls: Storage = {
        getItem: (key: string) => storage[key],
        removeItem: (key: string) => { delete storage[key]; },
        setItem: (key: string, value: string) => { storage[key] = value; },
    };
    setLocalStorage(ls);
}

Deno.test('configs have default values', () => {
    setup();
    const CONFIG_SPEC = [
        ["STRING", "/strings"],
        ["BOOLEAN", true],
        ["NUMBER", 5],
        ["BIGINT", 10n],
        ["OBJECT", { a: 1, b: "hello" }]
    ] as const;

    const ExampleConfig: ConfigInstance<typeof CONFIG_SPEC> = new Config("EXAMPLE", CONFIG_SPEC) as ConfigInstance<typeof CONFIG_SPEC>;

    assertEquals(ExampleConfig.STRING, "/strings");
    assertEquals(ExampleConfig.BOOLEAN, true);
    assertEquals(ExampleConfig.NUMBER, 5);
    assertEquals(ExampleConfig.BIGINT, 10n);
    assertEquals(ExampleConfig.OBJECT, { a: 1, b: "hello" });
});
