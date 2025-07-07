import { expandGlob } from "https://deno.land/std/fs/expand_glob.ts";
import { ensureDir } from "https://deno.land/std/fs/ensure_dir.ts";
import { join, relative, dirname } from "https://deno.land/std/path/mod.ts";

const exclude = [/\.test\.ts$/, "src/lib/react.ts"];

/**
 * Build the TypeScript source files into the `dist/` directory.
 *
 * Walks the `src/` tree, compiles script files and writes the
 * resulting JavaScript while preserving folder structure.
 */
export async function build(): Promise<void> {
  for await (const file of expandGlob("src/**/*.{ts,tsx}")) {
    if (!file.isFile) continue;
    if (
      exclude.some((e) =>
        typeof e === "string" ? file.path === e : e.test(file.path)
      )
    ) {
      continue;
    }
    const { files } = await Deno.emit(file.path, {
      importMapPath: "deno.json",
      compilerOptions: { target: "ESNext", jsx: "react-jsx" },
    });
    const jsPathKey = Object.keys(files).find((k) => k.endsWith(".js"));
    if (!jsPathKey) continue;
    const js = files[jsPathKey];
    const outPath = join(
      "dist",
      relative("src", file.path).replace(/\.tsx?$/, ".js"),
    );
    await ensureDir(dirname(outPath));
    await Deno.writeTextFile(outPath, js);
    console.log(`wrote ${outPath}`);
  }
}

if (import.meta.main) {
  await build();
}
