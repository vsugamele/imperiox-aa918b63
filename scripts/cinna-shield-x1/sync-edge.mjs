import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = await readFile(resolve(root,"src/lib/cinna-shield-x1/engine.ts"),"utf8");
await writeFile(resolve(root,"supabase/functions/cinna-shield-x1/engine.ts"),source);
console.log("Edge engine synchronized from the tested source.");
