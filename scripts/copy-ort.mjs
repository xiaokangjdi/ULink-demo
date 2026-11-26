#!/usr/bin/env node
// Copy the ONNX Runtime Web WASM/worker assets into public/ort for static hosting.
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "onnxruntime-web", "dist");
const target = join(root, "public", "ort");
mkdirSync(target, { recursive: true });
for (const name of readdirSync(source)) {
  if (name.endsWith(".wasm") || (name.startsWith("ort-wasm-") && name.endsWith(".mjs"))) {
    cpSync(join(source, name), join(target, name));
  }
}
console.log("copied ONNX Runtime Web assets to public/ort");
