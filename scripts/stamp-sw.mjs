#!/usr/bin/env node
// Stamps dist/sw.js's cache name with the git short hash so every deploy ships
// a changed service worker — activate() then deletes the old cache wholesale.
// Same hash source as vite.config.ts's __BUILD__.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = process.argv[2] || 'dist/sw.js';

let hash;
try {
  hash = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  hash = 'dev';
}

const src = readFileSync(FILE, 'utf8');
const re = /pokestrike-(?:v\d+|[0-9a-f]{7,}|dev)/;
if (!re.test(src)) {
  console.error(`stamp-sw: no pokestrike-<version> cache name in ${FILE} — is the CACHE const intact?`);
  process.exit(1);
}
writeFileSync(FILE, src.replace(re, `pokestrike-${hash}`));
console.log(`stamp-sw: ${FILE} cache -> pokestrike-${hash}`);
