#!/usr/bin/env node
// Copies every services/*/.env.example and apps/*/.env.example to a sibling
// .env if one doesn't already exist, so `pnpm dev` works with zero config.
import { readdirSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const roots = ["services", "apps"];
let copied = 0;

for (const root of roots) {
  if (!existsSync(root)) continue;
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    const example = join(dir, ".env.example");
    const target = join(dir, ".env");
    if (existsSync(example) && !existsSync(target)) {
      copyFileSync(example, target);
      console.log(`created ${target}`);
      copied++;
    }
  }
}

console.log(copied > 0 ? `\nDone — created ${copied} .env file(s).` : "\nAll .env files already present.");
