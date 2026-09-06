import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const svg = readFileSync(new URL('./icon-source.svg', import.meta.url));
const outDir = path.resolve('public');

const sizes = [
  { name: 'pwa-192.png', size: 192 },
  { name: 'pwa-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
];

for (const { name, size } of sizes) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, name));
  console.log('generated', name);
}

// Maskable icon with padding so Android doesn't crop the artwork
await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#0f1115' },
})
  .composite([
    {
      input: await sharp(svg, { density: 384 }).resize(360, 360).toBuffer(),
      top: 76,
      left: 76,
    },
  ])
  .png()
  .toFile(path.join(outDir, 'pwa-maskable-512.png'));
console.log('generated pwa-maskable-512.png');
