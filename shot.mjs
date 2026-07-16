import { chromium } from '@playwright/test';
const OUT = 'C:/Users/pdbry/AppData/Local/Temp/claude/c--Users-pdbry-OneDrive-Documents-sites-bidengine-v126/70414bb1-c416-45e6-a7d2-12a9e35482ea/scratchpad/shots';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('https://proofsync.vercel.app/', { waitUntil: 'networkidle' });
const h = await p.evaluate(() => document.body.scrollHeight);
console.log('page height:', h, 'screens:', (h/900).toFixed(1));
for (let i = 0; i < Math.min(8, Math.ceil(h / 900)); i++) {
  await p.evaluate((y) => window.scrollTo(0, y), i * 880);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/sec-${i}.png` });
}
await b.close();
