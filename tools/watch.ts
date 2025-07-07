import { watchFs } from "https://deno.land/std/fs/mod.ts";
import { build } from "./build.ts";

async function sync(): Promise<void> {
  const cmd = new Deno.Command("bitburner-filesync");
  const { code } = await cmd.output();
  if (code !== 0) {
    throw new Error(`bitburner-filesync exited with ${code}`);
  }
}

/**
 * Rebuild the project and sync files whenever source files change.
 */
export async function watch(): Promise<void> {
  await build();
  await sync();
  for await (const _ of watchFs("src")) {
    await build();
    await sync();
  }
}

if (import.meta.main) {
  await watch();
}
