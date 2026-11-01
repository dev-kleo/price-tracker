// Re-records the README screenshots that need no product data: welcome pages and the Settings footer. Output: docs/screens/.
import path from "node:path";
import fs from "node:fs";
import { launch, sleep } from "./lib.mjs";

const OUT = path.resolve(import.meta.dirname, "..", "docs", "screens");
fs.mkdirSync(OUT, { recursive: true });
const env = await launch();
await env.setSync({ useFetch: false, notificationsEnabled: false, language: "ru", theme: "light" });
await env.sw.evaluate(() => chrome.storage.local.set({ firstRunAt: Date.now() - 30 * 864e5, shareDismissed: true, rateDone: true }));

const w = await env.ctx.newPage();
await w.setViewportSize({ width: 640, height: 900 });
await w.goto(`chrome-extension://${env.extId}/welcome.html`); await w.waitForSelector(".steps li"); await sleep(600);
await w.screenshot({ path: path.join(OUT, "welcome-1.png") });
await w.getByRole("button", { name: "Далее" }).click(); await sleep(500);
await w.locator(".switch-row").click(); await sleep(300);
await w.screenshot({ path: path.join(OUT, "welcome-2.png") });
await env.sw.evaluate(() => chrome.storage.sync.remove("sharedHistory"));

const p = await env.ctx.newPage();
await p.setViewportSize({ width: 420, height: 760 });
await p.goto(`chrome-extension://${env.extId}/popup.html`); await sleep(900);
await p.locator(".topbar .round").first().click(); await sleep(400);
await p.locator(".menu-item", { hasText: "Настройки" }).click(); await sleep(900);
await p.locator(".version").scrollIntoViewIfNeeded(); await sleep(500);
await p.screenshot({ path: path.join(OUT, "settings.png") });
await env.close();
console.log("ok");
