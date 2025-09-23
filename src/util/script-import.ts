type InsertRemoteScriptOptions = {
    containerId?: string;
    module?: boolean; // use type="module"
    attributes?: Record<string, string>; // extra attrs (e.g. { nonce: "..." })
    timeoutMs?: number; // default 30_000
    /** How to record a content hash:
     *  - "none"  : don't fetch for hashing
     *  - "pre"   : fetch & hash before inserting (best for SRI logging, may delay exec)
     *  - "post"  : insert immediately; after load, fetch & hash in background (default)
     */
    recordHash?: 'none' | 'pre' | 'post';
    /** If provided, sets script.integrity = value (e.g., "sha256-...") and
     *  script.crossOrigin = "anonymous" by default. Browser will enforce it. */
    integrity?: string;
    /** If integrity is set but you need a different crossOrigin value, override here. */
    crossOrigin?: 'anonymous' | 'use-credentials' | '';
};

const installedByContainer = new Map<string, Set<string>>(); // containerId -> Set(resolvedUrl)
const pendingByContainer = new Map<string, Map<string, Promise<void>>>(); // containerId -> (resolvedUrl -> Promise)
const contentHashByUrl = new Map<string, string>(); // resolvedUrl -> sha256 hex (best-effort)

/** Ensure (or create) a container with id under parent (default: document.body). */
export function ensureContainerWithId(
    id: string,
    parent?: Element,
): HTMLElement {
    const doc = globalThis['document'];
    if (!doc) throw new Error('No document available.');
    const el = doc.getElementById(id);
    if (el instanceof HTMLElement) return el;
    const parentEl = parent ?? doc.body ?? doc.documentElement;
    const div = doc.createElement('div');
    div.id = id;
    parentEl.appendChild(div);
    return div;
}

function toHex(buf: ArrayBuffer): string {
    const b = new Uint8Array(buf);
    let out = '';
    for (let i = 0; i < b.length; i++)
        out += b[i].toString(16).padStart(2, '0');
    return out;
}

async function sha256HexArrayBuffer(ab: ArrayBuffer): Promise<string> {
    const d = await crypto.subtle.digest('SHA-256', ab);
    return toHex(d);
}

async function fetchAndHash(url: string): Promise<string> {
    // Use normal caching so we typically reuse the just-loaded response.
    const res = await fetch(url, {
        cache: 'force-cache',
        mode: 'cors' as RequestMode,
    });
    if (!res.ok)
        throw new Error(`Hash fetch failed: ${res.status} ${res.statusText}`);
    const ab = await res.arrayBuffer();
    return sha256HexArrayBuffer(ab);
}

function resolveUrl(input: string): string {
    return new URL(
        input,
        globalThis['document']?.baseURI ?? globalThis.location?.href ?? '',
    ).toString();
}

/** Load a remote script by URL, with de-dupe + optional content hashing. */
export async function insertRemoteScript(
    url: string,
    opts: InsertRemoteScriptOptions,
): Promise<void> {
    const {
        containerId = 'dyn-scripts',
        module = false,
        attributes,
        timeoutMs = 30_000,
        recordHash = 'post',
        integrity,
        crossOrigin,
    } = opts;

    if (!globalThis['document']) throw new Error('No document available.');

    const resolvedUrl = resolveUrl(url);
    const container = ensureContainerWithId(containerId);

    // Per-container registries
    let installed = installedByContainer.get(containerId);
    if (!installed) {
        installed = new Set();
        installedByContainer.set(containerId, installed);
    }
    let pendingMap = pendingByContainer.get(containerId);
    if (!pendingMap) {
        pendingMap = new Map();
        pendingByContainer.set(containerId, pendingMap);
    }

    // If already installed in this container, return fast.
    if (installed.has(resolvedUrl)) return;

    // If an install is in flight for this URL, await it.
    const inFlight = pendingMap.get(resolvedUrl);
    if (inFlight != null) return inFlight;

    // Optional pre-hash (blocks until we compute it, but avoids double transfer later via cache).
    let preHash: string | undefined;
    if (recordHash === 'pre' && globalThis.crypto?.subtle) {
        try {
            preHash = await fetchAndHash(resolvedUrl);
            contentHashByUrl.set(resolvedUrl, preHash);
        } catch (e) {
            // Don't fail load just because hashing failed; you can decide to throw if desired.
            console.warn(
                `[insertRemoteScript] pre-hash failed for ${resolvedUrl}:`,
                e,
            );
        }
    }

    const p = new Promise<void>((resolve, reject) => {
        const doc = globalThis['document'];
        const script = doc.createElement('script');

        if (module) script.type = 'module';
        if (attributes)
            for (const [k, v] of Object.entries(attributes))
                script.setAttribute(k, v);

        if (integrity) {
            script.integrity = integrity;
            script.crossOrigin = crossOrigin ?? 'anonymous';
        } else if (crossOrigin) {
            script.crossOrigin = crossOrigin;
        }

        let timeoutId: number | null = setTimeout(() => {
            cleanup();
            reject(
                new Error(
                    `Script load timed out after ${timeoutMs}ms: ${resolvedUrl}`,
                ),
            );
        }, timeoutMs);

        const cleanup = () => {
            if (timeoutId != null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            pendingMap.delete(resolvedUrl);
        };

        script.addEventListener('load', () => {
            cleanup();
            installed.add(resolvedUrl);
            // Optional post-hash (non-blocking to you, but we await it here so the promise
            // resolves *after* the hashing if recordHash === "post-wait". We stick to "post"
            // meaning we don't delay resolve; we just fire-and-forget).
            if (recordHash === 'post' && globalThis.crypto?.subtle) {
                // fire-and-forget
                fetchAndHash(resolvedUrl)
                    .then((h) => contentHashByUrl.set(resolvedUrl, h))
                    .catch((e) =>
                        console.warn(
                            `[insertRemoteScript] post-hash failed for ${resolvedUrl}:`,
                            e,
                        ),
                    );
            }
            resolve();
        });

        script.addEventListener('error', () => {
            cleanup();
            reject(new Error(`Script failed to load: ${resolvedUrl}`));
        });

        script.src = resolvedUrl;
        container.appendChild(script);
    });

    pendingMap.set(resolvedUrl, p);
    return p;
}

/** Has this exact resolved URL already been installed into this container? */
export function hasRemoteScript(containerId: string, url: string): boolean {
    const set = installedByContainer.get(containerId);
    if (!set) return false;
    return set.has(resolveUrl(url));
}

/** Best-effort recorded content hash for a previously loaded URL (hex SHA-256). */
export function getRecordedContentHash(url: string): string | undefined {
    return contentHashByUrl.get(resolveUrl(url));
}

/** Clear registries (does not remove existing DOM nodes). */
export function clearRemoteScriptRegistries(containerId?: string) {
    if (containerId) {
        installedByContainer.delete(containerId);
        pendingByContainer.delete(containerId);
    } else {
        installedByContainer.clear();
        pendingByContainer.clear();
    }
    // Keep contentHashByUrl unless you want to flush it too:
    // contentHashByUrl.clear();
}

/** Insert a script tag to fetch a script and return the UMD global the script installs. */
export async function importFromGlobal<T>(
    url: string,
    globalKey: string,
    opts: InsertRemoteScriptOptions = {},
): Promise<T> {
    await insertRemoteScript(url, opts);
    return assertGlobal<T>(
        globalKey,
        `Global "${globalKey}" not found after loading ${url}`,
    );
}

/** Assert that a global binding exists. */
export function assertGlobal<T>(globalKey: string, errorMessage: string): T {
    // @ts-expect-error: We're checking if this key exists on
    // globalThis so it's not an error.
    const v = globalThis[globalKey] as T | undefined;
    if (!v) throw new Error(errorMessage);
    return v;
}
