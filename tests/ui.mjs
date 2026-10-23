// Real extension in a real browser: migration of old-format data, unavailable/error views, chart styling, the group-chart filter,
// selection defaults/persistence, fullscreen, regression of folders and the regular-price toggle. Screenshots go to tests/results/shots.
import fs from "node:fs";
import path from "node:path";
import { launch, reporter, sleep } from "./lib.mjs";

const { check, finish } = reporter("ui");
const SHOTS = path.join(import.meta.dirname, "results", "shots");
fs.mkdirSync(SHOTS, { recursive: true });
const env = await launch();
await env.setSync({ useFetch: false, notificationsEnabled: false, language: "ru" });

const DAY = 864e5, NOW = Date.now();
const seed = (payload) => env.rpcPage.evaluate(async (pl) => {
  const db = await new Promise((res, rej) => { const o = indexedDB.open("ozon-price-tracker"); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
  const tx = db.transaction(["products", "priceHistory", "folders"], "readwrite");
  (pl.folders ?? []).forEach((f) => tx.objectStore("folders").put(f));
  pl.products.forEach((p) => tx.objectStore("products").put(p));
  pl.history.forEach((h) => tx.objectStore("priceHistory").put(h));
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close();
}, payload);

const product = (id, title, extra = {}) => ({ id, ozonProductId: id, title, url: `https://www.ozon.ru/product/x-${id}/`, canonicalUrl: `https://www.ozon.ru/product/${id}/`,
  currentPrice: 1000, lowestPrice: 900, highestPrice: 1200, historyPriceKind: "unknown", trackingStatus: "active", availability: "available", currency: "RUB",
  createdAt: NOW - 70 * DAY, updatedAt: NOW - 1000, lastCheckedAt: NOW - 3600e3, lastSuccessfulCheckAt: NOW - 3600e3, ...extra });
const hist = (pid, days, prices, kind = "unknown") => days.map((d, i) => ({ id: `${pid}:${kind}:${d}`, productId: pid, price: prices[i], timestamp: NOW - d * DAY, priceKind: kind }));

// ---- seed ------------------------------------------------------------------------------------------------------------------------
// (a) OLD-FORMAT products: exactly what v2.0-2.2 stored (no folderId, no status, no unavailable/error counters)
const legacy = ["9000001", "9000002", "9000003"].map((id, i) => {
  const p = product(id, `Старый товар ${i + 1}`); delete p.folderId; delete p.status; return p;
});
const legacyHist = legacy.flatMap((p) => hist(p.id, [60, 40, 20, 5], [1100, 1050, 990, 1000]));
await seed({ products: legacy, history: legacyHist });

// (b) a folder with 28 products: some unavailable (history ends 20 days ago), some errors
const FOLDER = "f-big", folders = [{ id: FOLDER, name: "Большая группа", createdAt: NOW - 50 * DAY }, { id: "f-empty", name: "Пустая", createdAt: NOW - 49 * DAY }, { id: "f-one", name: "Один товар", createdAt: NOW - 48 * DAY }, { id: "f-huge", name: "Огромная", createdAt: NOW - 47 * DAY }];
const goneIdx = new Set([3, 9, 20]), errIdx = new Set([5, 11]);
const big = [], bigHist = [];
for (let n = 1; n <= 28; n++) {
  const id = `70000${String(n).padStart(2, "0")}`; // 7000001 .. 7000028
  const title = n % 7 === 0 ? `Товар ${n} 15 литров` : `Товар ${n}`;
  const extra = { folderId: FOLDER, currentPrice: 1000 + n * 10 };
  if (goneIdx.has(n)) Object.assign(extra, { status: "unavailable", unavailableSince: NOW - 20 * DAY, unavailableChecks: 2, availability: "unavailable", availabilityReason: "out_of_stock", lastSuccessfulCheckAt: NOW - 20 * DAY });
  if (errIdx.has(n)) Object.assign(extra, { trackingStatus: "error", lastError: "Не удалось подтвердить цену", errorStreak: 3 });
  big.push(product(id, title, extra));
  const days = goneIdx.has(n) ? [60, 45, 30, 20] : [60, 40, 20, 0.2];
  bigHist.push(...hist(id, days, [1000 + n * 12, 1000 + n * 10, 1000 + n * 14, 1000 + n * 10]));
}
await seed({ folders, products: big, history: bigHist });
// (c) one product folder, (d) 120-product folder for the performance check
const one = product("7100001", "Единственный товар", { folderId: "f-one" });
const huge = [], hugeHist = [];
for (let n = 1; n <= 120; n++) { const id = `72${String(n).padStart(5, "0")}`; huge.push(product(id, n % 10 === 0 ? `Гаджет ${n} 15 см` : `Гаджет ${n}`, { folderId: "f-huge" })); hugeHist.push(...hist(id, [50, 25, 0.1], [900 + n, 950 + n, 1000 + n])); }
await seed({ products: [one, ...huge], history: [...hist(one.id, [30, 10, 0.1], [500, 520, 510]), ...hugeHist] });

// ---- open the dashboard tab ---------------------------------------------------------------------------------------------------
const errors = [];
const page = await env.ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.setViewportSize({ width: 1200, height: 900 });
const open = async (q = "") => { await page.goto(`chrome-extension://${env.extId}/popup.html?tab=1${q}`); await page.waitForSelector(".card, .empty", { timeout: 15000 }); await sleep(400); };
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const texts = (sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
const chip = (start) => page.locator(".chip", { hasText: new RegExp(`^${start}`) }).first();

await open();

// ---- MIGRATION: old-format records still render, history intact, nothing mutated by merely viewing ----------------------------------
console.log("\n=== migration (old-format data) ===");
const rawLegacy = await env.rpc("GET_PRODUCTS");
const l1 = rawLegacy.find((p) => p.id === "9000001");
check("legacy product has no status field (treated as active)", l1 && l1.status === undefined && l1.trackingStatus === "active", l1 && { status: l1.status, ts: l1.trackingStatus });
check("legacy products listed in the UI", (await texts(".card .title-row a")).filter((x) => x.startsWith("Старый товар")).length === 3);
check("legacy history intact", (await env.rpc("GET_HISTORY", { productId: "9000001", since: 0 })).length === 4);
check("legacy card shows no unavailable/error badge", !(await page.locator(".card", { hasText: "Старый товар 1" }).locator(".status.unavailable, .status.error").count()));
await page.locator(".card", { hasText: "Старый товар 1" }).locator(".actions .btn.plain", { hasText: /График|Chart/ }).click();
await page.waitForSelector(".card .chart svg");
check("legacy chart draws all 4 history points", (await page.$$eval(".card .chart svg circle", (c) => c.length)) >= 4);
await shot("01-legacy-chart");

// ---- UNAVAILABLE / ERRORS virtual filters ----------------------------------------------------------------------------------------
console.log("\n=== unavailable / errors views ===");
await open();
const chipsText = await texts(".chip");
check("virtual chip «Недоступные 3» shown", chipsText.some((c) => /^Недоступные 3$/.test(c)), chipsText);
check("virtual chip «Ошибки 2» shown", chipsText.some((c) => /^Ошибки 2$/.test(c)), chipsText);
await chip("Недоступные").click(); await sleep(300);
check("«Недоступные» lists exactly the 3 unavailable products", (await page.$$eval(".card", (c) => c.length)) === 3);
check("each shows the «Нет в наличии» badge and greyed card", (await page.$$eval(".card.unavail .status.unavailable", (b) => b.map((x) => x.textContent))).join() === "Нет в наличии,Нет в наличии,Нет в наличии");
const goneCard = await page.locator(".card.unavail").first().innerText();
check("last known price shown greyed with the date it was last seen", /Последняя цена · видели/.test(goneCard) && (await page.$$eval(".card.unavail strong.stale", (e) => e.length)) === 3, goneCard.slice(0, 160));
check("unavailable card has a «недоступен с» pill and no price-drop pills", /недоступен с/.test(goneCard) && !/Минимум за 30|Реальная скидка/.test(goneCard));
await shot("02-unavailable-view");
await chip("Ошибки").click(); await sleep(300);
check("«Ошибки» lists exactly the 2 errored products", (await page.$$eval(".card", (c) => c.length)) === 2 && (await page.$$eval(".card .status.error", (e) => e.length)) === 2);
await shot("03-errors-view");
const afterViews = await env.rpc("GET_PRODUCTS");
check("virtual filters never move products out of the user's folder", afterViews.filter((p) => p.folderId === FOLDER).length === 28);

// single-product chart of an unavailable product
await chip("Недоступные").click(); await sleep(250);
await page.locator(".card.unavail").first().locator(".actions .btn.plain", { hasText: /График/ }).click();
await page.waitForSelector(".card.unavail .chart svg");
const poly = await page.$eval(".card.unavail .chart svg polyline", (p) => ({ dash: p.getAttribute("stroke-dasharray"), stroke: p.getAttribute("stroke"), pts: p.getAttribute("points").trim().split(/\s+/).length }));
check("unavailable chart line is dashed and grey", !!poly.dash && poly.stroke.toLowerCase() === "#9aa4b5", poly);
check("line stops at the last real price (4 history points, no point added for 'now')", poly.pts === 4, poly);
check("chart says since when it is unavailable", /нет в наличии с/i.test(await page.locator(".card.unavail .chart svg").first().innerText().catch(() => "")) || (await page.$$eval(".card.unavail .chart svg text", (t) => t.map((x) => x.textContent))).some((x) => /нет в наличии с/.test(x)));
await shot("04-unavailable-chart");

// ---- GROUP CHART: default cap, filter, select/deselect matching, persistence --------------------------------------------------------
console.log("\n=== group chart (28 products) ===");
await open();
await page.locator(".chipgroup", { hasText: "Большая группа" }).locator(".chart-btn").click();
await page.waitForSelector(".group-chart svg");
const head = () => page.locator(".legend-head").innerText();
const rows = () => page.$$eval(".legend-item", (r) => r.length);
const lines = () => page.$$eval(".group-chart .chart-host svg polyline", (p) => p.length);
check("group of 28 opens with only the first 8 selected", /Выбрано 8 из 28/.test(await head()) && (await lines()) === 8, { head: await head(), lines: await lines() });
check("explanatory note about the 8-line default is shown", await page.locator(".cap-note").isVisible());
await shot("05-group-default-cap");

await page.evaluate(() => { document.querySelector(".group-chart .chart-host svg").__keep = true; });
const t0 = Date.now();
await page.fill(".gfilter", "15");
await page.waitForFunction(() => /найдено/.test(document.querySelector(".legend-head").textContent), null, { timeout: 5000 });
const tFilter = Date.now() - t0;
check("filter «15» matches name AND id/SKU (4 titles + id 7000015) -> 5 rows", (await rows()) === 5 && /найдено 5/.test(await head()), { rows: await rows(), head: await head() });
check("typing the filter does NOT rebuild the chart", await page.evaluate(() => document.querySelector(".group-chart .chart-host svg")?.__keep === true));
check(`filter applies quickly (${tFilter} ms incl. 150 ms debounce)`, tFilter < 700, tFilter);
check("buttons switch to «matching» wording with the count", await page.locator(".select-row .linkbtn", { hasText: "Выбрать найденные (5)" }).isVisible() && await page.locator(".select-row .linkbtn", { hasText: "Снять найденные (5)" }).isVisible());
await shot("06-group-filter-15");

await page.locator(".select-row .linkbtn", { hasText: "Только найденные" }).click(); await sleep(250);
check("«Только найденные» leaves exactly the 5 matching lines on the chart", (await lines()) === 5 && /Выбрано 5 из 28/.test(await head()), { lines: await lines(), head: await head() });
await page.locator(".select-row .linkbtn", { hasText: "Снять найденные (5)" }).click(); await sleep(250);
check("«Снять найденные» deselects only the matching ones (none left -> hint)", /Выбрано 0 из 28/.test(await head()) && await page.locator(".chart-host .note").isVisible());
await page.locator(".select-row .linkbtn", { hasText: "Выбрать найденные (5)" }).click(); await sleep(250);
check("«Выбрать найденные» selects only the matching ones", /Выбрано 5 из 28/.test(await head()) && (await lines()) === 5);
await page.locator(".gclear").click(); await sleep(300);
check("× clears the filter and shows all 28 rows with the normal buttons", (await rows()) === 28 && await page.locator(".select-row .linkbtn", { hasText: "Показать все" }).isVisible());
await page.locator(".only-sel input").check(); await sleep(250);
check("«Только выбранные» hides unselected rows (5 left)", (await rows()) === 5, await rows());
await page.locator(".only-sel input").uncheck();
await page.locator(".select-row .linkbtn", { hasText: "Показать все" }).click(); await sleep(250);
check("«Показать все» selects all 28 lines", (await lines()) === 28 && /Выбрано 28 из 28/.test(await head()));
await page.locator(".select-row .linkbtn", { hasText: "Скрыть все" }).click(); await sleep(200);
// selection persistence: pick the «15» products, leave, come back
await page.fill(".gfilter", "15"); await page.waitForFunction(() => /найдено 5/.test(document.querySelector(".legend-head").textContent));
await page.locator(".select-row .linkbtn", { hasText: "Только найденные" }).click(); await sleep(700); // > save debounce
const saved = await env.rpcPage.evaluate(() => chrome.storage.local.get("groupSel"));
check("selection is saved to storage", saved.groupSel?.[FOLDER]?.sel?.length === 5, saved.groupSel?.[FOLDER]);
await open();
await page.locator(".chipgroup", { hasText: "Большая группа" }).locator(".chart-btn").click();
await page.waitForSelector(".group-chart svg");
check("reopening the group keeps the user's last selection (5, not the default 8)", /Выбрано 5 из 28/.test(await head()) && (await lines()) === 5 && !(await page.locator(".cap-note").isVisible()), { head: await head(), lines: await lines() });
await shot("07-group-selection-restored");

// ---- group chart: rest of the edge cases --------------------------------------------------------------------------------------------
console.log("\n=== group chart edge cases ===");
await open();
await page.locator(".chipgroup", { hasText: "Пустая" }).locator(".chart-btn").click(); await sleep(400);
check("empty folder: friendly message, no chart", await page.locator(".group-chart .note", { hasText: "пока нет товаров" }).isVisible() && !(await page.locator(".group-chart svg").count()));
await open();
await page.locator(".chipgroup", { hasText: "Один товар" }).locator(".chart-btn").click(); await page.waitForSelector(".group-chart svg");
check("single product: one line, one legend row, no filter row, hint to add more", (await lines()) === 1 && (await rows()) === 1 && !(await page.locator(".gfilter").count()) && await page.locator(".group-chart .note", { hasText: "один товар" }).isVisible());
await open();
await page.locator(".chipgroup", { hasText: "Огромная" }).locator(".chart-btn").click(); await page.waitForSelector(".group-chart svg");
check("120-product group: default cap of 8 lines, 120 legend rows", (await lines()) === 8 && (await rows()) === 120, { lines: await lines(), rows: await rows() });
await page.evaluate(() => { document.querySelector(".group-chart .chart-host svg").__keep = true; });
const t1 = Date.now();
await page.fill(".gfilter", "15");
await page.waitForFunction(() => /найдено/.test(document.querySelector(".legend-head").textContent), null, { timeout: 5000 });
const tHuge = Date.now() - t1;
check("120 products: filter «15» -> 12 titles (10,20,...,120 end in 0 only 'Гаджет N 15 см' = 12) + id matches", (await rows()) >= 12, { rows: await rows(), head: await head() });
check(`120 products: filter responds fast (${tHuge} ms) without rebuilding the chart`, tHuge < 800 && await page.evaluate(() => document.querySelector(".group-chart .chart-host svg")?.__keep === true), tHuge);
// price returning after being unavailable is covered by availability-flow; all-unavailable group:
const goneOne = { ...one, status: "unavailable", unavailableSince: NOW - 5 * DAY, unavailableChecks: 2, availability: "unavailable", lastSuccessfulCheckAt: NOW - 5 * DAY };
await seed({ products: [goneOne], history: [] });
await open();
await page.locator(".chipgroup", { hasText: "Один товар" }).locator(".chart-btn").click(); await page.waitForSelector(".group-chart svg");
check("group where every product is unavailable still renders (faded dotted line + tag)", (await page.$$eval(".group-chart svg polyline", (p) => p.every((x) => x.getAttribute("stroke-dasharray") === "2 3"))) && await page.locator(".legend-item .tag").isVisible());

// ---- FULLSCREEN ----------------------------------------------------------------------------------------------------------------------
console.log("\n=== fullscreen ===");
await open();
await page.locator(".chipgroup", { hasText: "Большая группа" }).locator(".chart-btn").click(); await page.waitForSelector(".group-chart svg");
const fsBtn = page.locator(".group .fs-btn");
check("fullscreen button present with tooltip «На весь экран»", (await fsBtn.getAttribute("title")) === "На весь экран");
const before = await page.$eval(".group-chart .chart-host svg", (s) => ({ vb: s.getAttribute("viewBox"), h: s.getBoundingClientRect().height }));
await fsBtn.click(); await sleep(900);
const inFs = await page.evaluate(() => ({ el: document.fullscreenElement?.className ?? null, vb: document.querySelector(".group-chart .chart-host svg")?.getAttribute("viewBox"), h: document.querySelector(".group-chart .chart-host svg")?.getBoundingClientRect().height, w: innerWidth, hh: innerHeight, title: document.querySelector(".fs-btn")?.title }));
check("Fullscreen API entered on the group container", inFs.el === "group", inFs);
const fit = await page.$eval(".group-chart .chart-host", (host) => { const svg = host.querySelector("svg"), vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect(), hr = host.getBoundingClientRect(); return { vbAspect: vb.width / vb.height, svgAspect: r.width / r.height, svgH: r.height, hostH: hr.height, hostW: hr.width, svgW: r.width }; });
check("chart is redrawn at the fullscreen size and fills its area without letterboxing", inFs.vb !== before.vb && Math.abs(fit.vbAspect / fit.svgAspect - 1) < 0.03 && fit.svgH > 0.95 * fit.hostH && fit.svgW > 0.95 * fit.hostW, { before, inFs, fit });
check("button now offers «Выйти из полноэкранного режима»", /Выйти/.test(inFs.title), inFs.title);
await shot("08-group-fullscreen");
await page.fill(".gfilter", "15"); await page.waitForFunction(() => /найдено 5/.test(document.querySelector(".legend-head").textContent), null, { timeout: 5000 });
check("filter panel stays usable in fullscreen", (await rows()) === 5 && !!(await page.evaluate(() => document.fullscreenElement)));
await page.keyboard.press("Escape"); await sleep(700);
let exited = await page.evaluate(() => !document.fullscreenElement);
if (!exited) { await page.evaluate(() => document.exitFullscreen()); await sleep(500); exited = await page.evaluate(() => !document.fullscreenElement); }
const afterFs = await page.$eval(".group-chart .chart-host svg", (s) => s.getAttribute("viewBox"));
check("leaving fullscreen restores the normal chart size", exited && afterFs === before.vb, { exited, afterFs, before: before.vb });
const escNative = await (async () => { await fsBtn.click(); await sleep(600); await page.keyboard.press("Escape"); await sleep(700); return page.evaluate(() => !document.fullscreenElement); })();
console.log(`INFO  Esc key exits fullscreen in this headless browser: ${escNative} (in real Chrome Esc is handled by the browser itself)`);
if (!escNative) await page.evaluate(() => document.exitFullscreen());

// single-product chart fullscreen
await open();
await page.locator(".card", { hasText: "Старый товар 1" }).locator(".actions .btn.plain", { hasText: /График/ }).click();
await page.waitForSelector(".card .chart svg");
const vb0 = await page.$eval(".card .chart .chart-host svg", (s) => s.getAttribute("viewBox"));
await page.locator(".card .chart .fs-btn").click(); await sleep(900);
const fs2 = await page.evaluate(() => ({ el: document.fullscreenElement?.className ?? null, vb: document.querySelector(".chart .chart-host svg")?.getAttribute("viewBox"), h: document.querySelector(".chart .chart-host svg")?.getBoundingClientRect().height }));
check("single-product chart: fullscreen entered and chart enlarged", fs2.el === "chart" && fs2.vb !== vb0 && fs2.h > 300, fs2);
await shot("09-chart-fullscreen");
await page.evaluate(() => document.exitFullscreen()); await sleep(600);
check("single-product chart returns to normal size", (await page.$eval(".card .chart .chart-host svg", (s) => s.getAttribute("viewBox"))) === vb0);

// ---- REGRESSION: folders, regular-price toggle -----------------------------------------------------------------------------------------
console.log("\n=== regression ===");
await open();
await page.locator(".chip.add").click(); await page.fill(".folder-edit input", "Новая папка"); await page.keyboard.press("Enter"); await sleep(500);
check("create folder via UI", (await env.rpc("GET_FOLDERS")).some((f) => f.name === "Новая папка"));
const nf = (await env.rpc("GET_FOLDERS")).find((f) => f.name === "Новая папка");
await page.locator(".folder-actions .btn", { hasText: "Переименовать" }).click(); await page.fill(".folder-edit input", "Переименована"); await page.keyboard.press("Enter"); await sleep(500);
check("rename folder via UI", (await env.rpc("GET_FOLDERS")).some((f) => f.id === nf.id && f.name === "Переименована"));
await env.rpc("SET_PRODUCT_FOLDER", { id: "9000001", folderId: nf.id });
check("move product to folder", (await env.rpc("GET_PRODUCTS")).find((p) => p.id === "9000001").folderId === nf.id);
await env.rpc("DELETE_FOLDER", { id: nf.id });
const afterDel = (await env.rpc("GET_PRODUCTS")).find((p) => p.id === "9000001");
check("delete folder keeps the product (ungrouped)", afterDel && afterDel.folderId === null);
// regular-price toggle with an Ozon Card product
const card = product("8000001", "Карточный товар", { historyPriceKind: "ozon_card", regularPrice: 1100, ozonCardPrice: 1000 });
await seed({ products: [card], history: [...hist(card.id, [40, 20, 1], [1000, 950, 1000], "ozon_card"), ...hist(card.id, [40, 20, 1], [1100, 1050, 1100], "unknown")] });
await open();
await page.locator(".card", { hasText: "Карточный товар" }).locator(".actions .btn.plain", { hasText: /График/ }).click(); await page.waitForSelector(".card .chart svg");
const two = await page.$$eval(".card .chart svg polyline", (p) => p.length);
await page.locator(".card .chart .toggle input").uncheck(); await sleep(500);
const one2 = await page.$$eval(".card .chart svg polyline", (p) => p.length);
await page.locator(".card .chart .toggle input").check(); await sleep(500);
check("regular-price toggle still works (2 lines -> 1 -> 2)", two === 2 && one2 === 1 && (await page.$$eval(".card .chart svg polyline", (p) => p.length)) === 2, { two, one2 });

check("no console errors or page exceptions during the whole run", errors.length === 0, errors.slice(0, 5));
await env.close();
process.exit(finish() ? 1 : 0);
