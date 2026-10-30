import fs from 'node:fs';
import sharp from 'sharp';
const d = new URL('../assets/shaman-totems-v1/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', d), 'utf8'));
for (const a of manifest)
  await sharp(fs.readFileSync(new URL(a.file, d)))
    .resize(256, 256)
    .webp({ quality: 88 })
    .toFile(new URL(a.preview, d));
console.log('Refreshed existing totem previews; approval and masters preserved.');
