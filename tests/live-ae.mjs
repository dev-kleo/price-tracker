// MANUAL check against the LIVE aliexpress.ru (not part of the suites; needs network access and may meet the site's bot check).
// Runs the real extension code and prints what it extracts, next to what the page shows.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CHROMIUM, extensionWithAliExpress, sleep } from "./lib.mjs";

const ext = extensionWithAliExpress();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pt-live-"));
const ctx = await chromium.launchPersistentContext(dir, { executablePath: CHROMIUM, headless: false, viewport: { width: 1280, height: 900 }, locale: "ru-RU",
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "--no-first-run"] });
let sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
const page = ctx.pages()[0] ?? (await ctx.newPage());
const ask = async () => { for (let i = 0; i < 30; i++) { const r = await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ url: ["https://aliexpress.ru/*", "https://www.aliexpress.ru/*"] }); return chrome.tabs.sendMessage(t.id, { type: "GET_AE_SNAPSHOT" }).catch((e) => ({ err: String(e) })); }); if (r && !r.err) return r; await sleep(500); } return null; };
const shown = () => page.evaluate(() => ({ url: location.pathname + location.search, title: document.title.slice(0, 60), price: document.querySelector('[class*="SnowPrice__mainM"]')?.innerText ?? null, active: [...document.querySelectorAll('button[class*="optionActive"]')].map((b) => b.innerText.trim() || "(image)") }));
const log = async (label) => { const s = await shown(); const x = await ask(); console.log(`\n== ${label}\nPAGE     :`, JSON.stringify(s), "\nEXTRACTED:", JSON.stringify(x && { id: x.ozonProductId, price: x.price?.value, variant: x.variantLabel, url: x.canonicalUrl, title: x.title?.slice(0, 50), unavailable: x.unavailable, blocked: x.blocked })); };

await page.goto("https://aliexpress.ru/", { waitUntil: "commit", timeout: 60000 }); await sleep(4000);
const link = async (n) => { await page.waitForSelector('a[href*="/item/"]', { timeout: 45000 }).catch(() => {}); return page.evaluate((i) => { const a = [...document.querySelectorAll('a[href*="/item/"]')][i]; a.removeAttribute("target"); a.click(); return a.href.slice(0, 60); }, n); };
await page.goto("https://aliexpress.ru/wholesale?SearchText=usb+cable", { waitUntil: "commit", timeout: 60000 }); await sleep(4500);
console.log("search page:", await page.title(), page.url().slice(0, 80));
console.log("open", await link(2)); await sleep(6000);
await log("item with variants (selected 1M)");
await page.evaluate(() => [...document.querySelectorAll('button[class*="option__"]')].find((b) => b.innerText.trim() === "3M")?.click()); await sleep(2500);
await log("same item after clicking 3M");
await page.goto("https://aliexpress.ru/", { waitUntil: "commit", timeout: 60000 }); await sleep(4000);
console.log("open", await link(0)); await sleep(6000);
await log("item with a coupon line (price must be the main price)");
await page.evaluate(() => { location.href = "https://aliexpress.ru/item/1005000000000001.html"; }); await sleep(6000);
await log("removed item (404)");
await ctx.close(); fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(ext, { recursive: true, force: true });
