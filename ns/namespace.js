export function namespaced(nsKey, config) {
    const name = config.name ?? `ns:${String(nsKey)}`;
    return {
        name,
        __nsKey__: nsKey,
        setup: config.setup,
    };
}
