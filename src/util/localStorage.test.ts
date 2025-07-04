import { Config, ConfigSpec } from "./localStorage";

type ConfigKeys = "STRING" | "BOOLEAN" | "NUMBER" | "BIGINT" | "OBJECT";

const CONFIG_SPEC: ConfigSpec<ConfigKeys>[] = [
    ["STRING", "/strings"],
    ["BOOLEAN", true],
    ["NUMBER", 5],
    ["BIGINT", 10n],
    ["OBJECT", { a: 1, b: "hello" }]
];

test('configs have default values', () => {
    const ExampleConfig = new Config("EXAMPLE", CONFIG_SPEC);

    expect(ExampleConfig.STRING).toBe("/strings");
    expect(ExampleConfig.BOOLEAN).toBe(true);
    expect(ExampleConfig.NUMBER).toBe(5);
    expect(ExampleConfig.BIGINT).toBe(10n);
    expect(ExampleConfig.OBJECT).toBe({ a: 1, b: "hello" });
});
