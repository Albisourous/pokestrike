#!/usr/bin/env node
// Generate pixel-art assets with the PixelLab v2 API into public/gen/.
// Usage:
//   node scripts/gen-assets.mjs --check          # print credit balance
//   node scripts/gen-assets.mjs                  # generate every asset below
//   node scripts/gen-assets.mjs court-grove ...  # generate a subset
// Token: PIXELLAB_API_TOKEN env var or a line in .env (from pixellab.ai
// account settings). Generated files land in public/gen/<name>.png and are
// not referenced by the game until you wire them into the renderer.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'gen');
const API = 'https://api.pixellab.ai/v2';

// Shared style suffix keeps every generated asset in the same FRLG-era look.
const STYLE =
  'Game Boy Advance era pixel art, Pokemon FireRed/LeafGreen style, clean outlines, soft cel shading';

// name -> what to generate. `bg: true` asks for a transparent background.
const ASSETS = {
  'court-grove': {
    prompt: `seamless top-down grass stadium court floor, short mowed grass, ${STYLE}`,
    size: 128,
  },
  'court-cavern': {
    prompt: `seamless top-down stone cave floor, slate tiles, ${STYLE}`,
    size: 128,
  },
  'court-caldera': {
    prompt: `seamless top-down volcanic basalt court floor, dark rock with faint lava veins, ${STYLE}`,
    size: 128,
  },
  'court-sky': {
    prompt: `seamless top-down cloud court floor, puffy white clouds on pale blue, ${STYLE}`,
    size: 128,
  },
};

function token() {
  let t = process.env.PIXELLAB_API_TOKEN;
  const envPath = join(root, '.env');
  if (!t && existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*PIXELLAB_API_TOKEN\s*=\s*(.+?)\s*$/);
      if (m) t = m[1].replace(/^['"]|['"]$/g, '');
    }
  }
  if (!t) {
    console.error('Missing PIXELLAB_API_TOKEN — set it in the environment or .env');
    console.error('Get a token at https://pixellab.ai (account settings).');
    process.exit(1);
  }
  return t;
}

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function generate(name, spec) {
  const out = join(outDir, `${name}.png`);
  if (existsSync(out)) {
    console.log(`skip ${name} (public/gen/${name}.png exists — delete to regenerate)`);
    return;
  }
  const { image, usage } = await api('/create-image-pixen', {
    description: spec.prompt,
    image_size: { width: spec.size, height: spec.size },
    no_background: !!spec.bg,
    detail: 'highly detailed',
  });
  writeFileSync(out, Buffer.from(image.base64, 'base64'));
  console.log(`wrote public/gen/${name}.png (${usage?.usd ?? '?'} usd)`);
}

const args = process.argv.slice(2);
if (args.includes('--check')) {
  const res = await fetch(`${API}/balance`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  console.log(JSON.stringify(await res.json(), null, 2));
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const names = args.length ? args : Object.keys(ASSETS);
for (const name of names) {
  const spec = ASSETS[name];
  if (!spec) {
    console.error(`unknown asset "${name}" — add it to ASSETS in this script`);
    continue;
  }
  try {
    await generate(name, spec);
  } catch (e) {
    console.error(`${name}: ${e.message}`);
  }
}
