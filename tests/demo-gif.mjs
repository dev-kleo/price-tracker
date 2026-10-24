// Records docs/demo.gif: a scripted tour of the popup with seeded demo data (no real products). Needs ffmpeg on PATH.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { launch, sleep } from "./lib.mjs";

const OUT = path.resolve(import.meta.dirname, "..", "docs", "demo.gif"), TMP = path.join(import.meta.dirname, "results", "demo-frames");
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
const DAY = 864e5, NOW = Date.now(), FPS = 20;
const names = [
  ["Электрочайник Xiaomi 1.7 л", 2490, "#5EEAD4"], ["Наушники Sony WH-1000XM5", 24990, "#A78BFA"], ["Кофемашина DeLonghi Magnifica", 38990, "#F59E0B"],
  ["Робот-пылесос Roborock Q7", 21490, "#60A5FA"], ["Смарт-часы Amazfit GTR 4", 14290, "#F472B6"], ["Монитор LG UltraGear 27\"", 18990, "#34D399"],
  ["Клавиатура Keychron K2", 7990, "#FB7185"], ["Увлажнитель Xiaomi Smart", 3290, "#38BDF8"], ["Чайник Redmond 1.5 л", 1790, "#FBBF24"],
  ["Пауэрбанк Anker 20000", 3990, "#818CF8"], ["Электрочайник Bosch Sky", 5290, "#2DD4BF"], ["Мышь Logitech MX Master 3S", 8490, "#F87171"],
];
const shape = (i) => ({ id: `600${String(i).padStart(4, "0")}`, mood: [-0.18, 0.06, -0.12, -0.22, 0.05, -0.1, 0, -0.15, 0.08, -0.07, -0.05, 0][i] });
const products = [], history = [];
names.forEach(([title, price, color], i) => {
  const { id, mood } = shape(i), start = Math.round(price / (1 + mood));
  const unavailable = i === 5, err = i === 8;
  products.push({ id, ozonProductId: id, title, url: `https://www.ozon.ru/product/x-${id}/`, canonicalUrl: `https://www.ozon.ru/product/${id}/`, currentPrice: price, lowestPrice: Math.min(price, start), highestPrice: Math.max(price, start),
    historyPriceKind: "unknown", trackingStatus: err ? "error" : "active", availability: unavailable ? "unavailable" : "available", currency: "RUB", imageUrl: `https://demo.invalid/img/${i}.svg?c=${encodeURIComponent(color)}`,
    createdAt: NOW - 70 * DAY, updatedAt: NOW - i * 1000, lastCheckedAt: NOW - 25 * 60e3, lastSuccessfulCheckAt: unavailable ? NOW - 9 * DAY : NOW - 25 * 60e3, folderId: i % 2 === 0 ? "f-home" : "f-tech",
    ...(unavailable ? { status: "unavailable", unavailableSince: NOW - 9 * DAY, unavailableChecks: 2 } : {}), ...(err ? { lastError: "Не удалось подтвердить цену", errorStreak: 3 } : {}), ...(i === 0 ? { targetPrice: 2200 } : {}) });
  let seed = i * 7 + 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const days = [65, 58, 50, 44, 38, 31, 25, 19, 13, 8, 4, 1.5, 0.2];
  days.forEach((d, k) => { const t = k / (days.length - 1); const v = Math.round((start + (price - start) * Math.min(1, t * 1.4)) * (1 + (rnd() - 0.5) * 0.06)); if (!(unavailable && d < 9)) history.push({ id: `${id}:${k}`, productId: id, price: k === days.length - 1 ? price : v, timestamp: NOW - d * DAY, priceKind: "unknown" }); });
});
const folders = [{ id: "f-home", name: "Дом", createdAt: NOW - 60 * DAY }, { id: "f-tech", name: "Техника", createdAt: NOW - 59 * DAY }];

const env = await launch();
await env.setSync({ useFetch: false, notificationsEnabled: false, language: "ru", theme: "auto" });
await env.rpcPage.evaluate(async (pl) => {
  const db = await new Promise((res) => { const o = indexedDB.open("ozon-price-tracker"); o.onsuccess = () => res(o.result); });
  const tx = db.transaction(["products", "priceHistory", "folders"], "readwrite");
  pl.folders.forEach((f) => tx.objectStore("folders").put(f)); pl.products.forEach((p) => tx.objectStore("products").put(p)); pl.history.forEach((h) => tx.objectStore("priceHistory").put(h));
  await new Promise((r) => { tx.oncomplete = r; });
}, { products, history, folders });
await env.sw.evaluate((t) => chrome.storage.local.set({ firstRunAt: t, shareDismissed: true, rateDone: true }), NOW - 30 * DAY);

const page = await env.ctx.newPage();
await page.setViewportSize({ width: 420, height: 600 });
await page.route("https://demo.invalid/img/**", (route) => {
  const c = new URL(route.request().url()).searchParams.get("c") ?? "#888";
  route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="${c}" fill-opacity=".22"/><circle cx="24" cy="24" r="12" fill="${c}"/></svg>` });
});
await page.goto(`chrome-extension://${env.extId}/popup.html`);
await page.waitForSelector(".row.product"); await sleep(900);

// screencast with timestamps
const cdp = await env.ctx.newCDPSession(page);
const frames = [];
cdp.on("Page.screencastFrame", async (f) => { frames.push({ t: f.metadata.timestamp * 1000, data: f.data }); try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch { /* ended */ } });
await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
const t0 = Date.now();
const wait = (ms) => sleep(ms);
const moveAlong = async (box, from, to, steps, ms) => { for (let i = 0; i <= steps; i++) { await page.mouse.move(box.x + box.width * (from + ((to - from) * i) / steps), box.y + box.height * 0.5); await wait(ms); } };

await wait(1400);                                                        // list
await page.locator(".seg-item").nth(1).click(); await wait(1300);       // Снизились
await page.locator(".seg-item").nth(0).click(); await wait(900);
await page.locator(".row.product").first().click(); await wait(1500);   // detail (spring push, count-up, chart draw)
const box = await page.locator(".detail svg.chart").boundingBox();
await moveAlong(box, 0.08, 0.92, 28, 55); await wait(700);              // scrub
await page.locator(".detail .seg-item").nth(0).click(); await wait(1000);
await page.locator(".back").last().click(); await wait(1000);
await page.locator(".tab", { hasText: "Папки" }).click(); await wait(900);
await page.locator(".row", { hasText: "Техника" }).click(); await wait(1000);
await page.locator(".pill.primary", { hasText: "График группы" }).click(); await wait(1900); // group chart
await page.locator(".back").last().click(); await wait(500);
await page.locator(".back").last().click(); await wait(500);
await page.locator(".tab", { hasText: "Товары" }).click(); await wait(1200);
await cdp.send("Page.stopScreencast");
await env.close();

// resample to a fixed frame rate
frames.sort((a, b) => a.t - b.t);
const start = frames[0].t, end = frames.at(-1).t, n = Math.floor(((end - start) / 1000) * FPS);
let j = 0;
for (let i = 0; i < n; i++) { const tt = start + (i * 1000) / FPS; while (j + 1 < frames.length && frames[j + 1].t <= tt) j++; fs.writeFileSync(path.join(TMP, `f${String(i).padStart(4, "0")}.png`), Buffer.from(frames[j].data, "base64")); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const pal = path.join(TMP, "pal.png");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(TMP, "f%04d.png"), "-vf", "scale=360:-1:flags=lanczos,palettegen=max_colors=96:stats_mode=diff", pal]);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(TMP, "f%04d.png"), "-i", pal, "-lavfi", "scale=360:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", "-loop", "0", OUT]);
console.log(`${n} frames, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB -> ${OUT}`, Math.round(Date.now() - t0) / 1000, "s");
