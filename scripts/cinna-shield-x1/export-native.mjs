import { readFile } from "node:fs/promises";
import { build } from "esbuild";

// Offline conversion only. Import the output once; never overwrite edited automations.
const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/cinna-shield-x1/export-native.mjs <config-envelope.json>");
const envelope = JSON.parse(await readFile(source, "utf8"));
const result = await build({ entryPoints: ["src/lib/cinna-shield-x1/openflow.ts"], bundle: true, platform: "node", format: "esm", write: false });
const { toNativeCinnaFlow } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
process.stdout.write(JSON.stringify(toNativeCinnaFlow(envelope.config, envelope.model), null, 2));
