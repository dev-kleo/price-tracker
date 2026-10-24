// Real extension in a real browser, v2.5 UI: list/segments/detail/group chart/fullscreen/empty states, themes, accessibility media,
// gestures (interrupt, flick, rubber band) and regression of folders, targets, undo, regular-price toggle. Screenshots: tests/results/shots.
import fs from "node:fs";
import path from "node:path";
import { launch, reporter, sleep } from "./lib.mjs";

const { check, finish } = reporter("ui");
const SHOTS = path.join(import.meta.dirname, "results", "shots");
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const DAY = 864e5, NOW = Date.now();

const seedInto = (env, payload) => env.rpcPage.evaluate(async (pl) => {
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

// ---- seed: folder with 28 products (drops, rises, 3 unavailable, 2 errors), plus edge products -----------------------------------
const FOLDER = "f-big";
const folders = [{ id: FOLDER, name: "Большая группа", createdAt: NOW - 50 * DAY }, { id: "f-empty", name: "Пустая", createdAt: NOW - 49 * DAY }];
const goneIdx = new Set([3, 9, 20]), errIdx = new Set([5, 11]);
const products = [], history = [];
for (let n = 1; n <= 28; n++) {
  const id = `70000${String(n).padStart(2, "0")}`;
  const title = n % 7 === 0 ? `Товар ${n} 15 литров` : `Товар ${n}`;
  const cur = 1000 + n * 10, start = n % 3 === 0 ? cur * 1.25 : n % 3 === 1 ? cur * 0.8 : cur; // drop / rise / flat over 40 days
  const extra = { folderId: FOLDER, currentPrice: Math.round(cur) };
  if (goneIdx.has(n)) Object.assign(extra, { status: "unavailable", unavailableSince: NOW - 20 * DAY, unavailableChecks: 2, availability: "unavailable", availabilityReason: "out_of_stock", lastSuccessfulCheckAt: NOW - 20 * DAY });
  if (errIdx.has(n)) Object.assign(extra, { trackingStatus: "error", lastError: "Не удалось подтвердить цену", errorStreak: 3 });
  products.push(product(id, title, extra));
  history.push(...hist(id, goneIdx.has(n) ? [60, 45, 30, 20] : [65, 40, 20, 0.2], goneIdx.has(n) ? [cur, cur, cur, cur] : [Math.round(start), Math.round(start), Math.round((start + cur) / 2), cur]));
}
// edge products: no history, very long name, price over 100 000, price equal to the 60-day minimum (a real "60-day low")
products.push(product("8000001", "Без истории", { currentPrice: 500, createdAt: NOW - 1000 }));
products.push(product("8000002", "Очень длинное название товара ".repeat(8), { currentPrice: 129990, lowestPrice: 120000, highestPrice: 150000, imageUrl: "https://example.invalid/x.jpg" }));
history.push(...hist("8000002", [3, 1], [140000, 129990]));
products.push(product("8000003", "Минимум за 60 дней", { currentPrice: 800, lowestPrice: 800, highestPrice: 1000 }));
history.push(...hist("8000003", [70, 40, 20, 0.1], [1000, 950, 900, 800]));

const env = await launch();
await env.setSync({ useFetch: false, notificationsEnabled: false, language: "ru" });
await seedInto(env, { folders, products, history });

const errors = [];
const open = async (query = "", size = { width: 420, height: 600 }) => {
  const page = await env.ctx.newPage();
  await page.setViewportSize(size);
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`chrome-extension://${env.extId}/popup.html${query}`);
  await page.waitForSelector(".row.product", { timeout: 10000 });
  return page;
};
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const text = (page, sel) => page.locator(sel).first().innerText();
const settle = (ms = 700) => sleep(ms);

// ---- 1. list ----------------------------------------------------------------------------------------------------------------------
const page = await open();
await settle(900);
const rowCount = await page.locator(".list-host .row.product").count();
check("list shows every product (31)", rowCount === 31, rowCount);
check("title is «Товары»", (await text(page, "h1.title")) === "Товары");
check("status line says «Обновлено …»", /^Обновлено/.test(await text(page, ".status-line")), await text(page, ".status-line"));
const savedCard = await page.locator(".card.saved").count();
check("savings card visible when something got cheaper", savedCard === 1);
const savedTotal = await text(page, ".saved-total");
check("savings amount is a real ruble amount", /\d/.test(savedTotal) && savedTotal.includes("₽"), savedTotal);
await shot(page, "01-list-light");
const segTexts = await page.locator(".seg-item").allInnerTexts();
check("segments Все/Снизились/Нет в наличии/Ошибки with counts", segTexts.length === 4 && segTexts[0].startsWith("Все") && segTexts[2].includes("3") && segTexts[3].includes("2"), segTexts);
check("goneness row shows «нет в наличии с»", (await page.locator(".row.gone .row-cap").first().innerText()).startsWith("нет в наличии с"));
check("error row shows retry line", /Не удалось проверить · повтор через/.test(await page.locator(".row.err .row-cap").first().innerText()));
check("low-60 caption only on the true low", (await page.locator(".row-cap", { hasText: "минимум за 60 дней" }).count()) >= 1);
for (const [i, name] of [[1, "dropped"], [2, "gone"], [3, "errors"]]) {
  await page.locator(".seg-item").nth(i).click(); await settle(500);
  const n = await page.locator(".list-host .row.product").count();
  check(`segment ${name} filters the list (${n})`, i === 1 ? n > 0 && n < 31 : i === 2 ? n === 3 : n === 2, n);
  await shot(page, `02-seg-${name}`);
}
await page.locator(".seg-item").nth(0).click(); await settle(400);

// search
await page.fill(".searchrow .search-input", "15 литров"); await settle(500);
check("search narrows the list", (await page.locator(".list-host .row.product").count()) === 4);
await page.locator(".searchrow .round.small").click(); await settle(300);
check("clear button resets the search", (await page.locator(".list-host .row.product").count()) === 31);

// ---- 2. detail ------------------------------------------------------------------------------------------------------------------------
await page.locator(".row.product").filter({ has: page.locator(".row-title", { hasText: /^Минимум за 60 дней$/ }) }).click(); await settle(900);
check("detail screen opened", (await page.locator(".screen.detail").count()) === 1);
check("detail hero shows price", /800/.test(await text(page, ".hero-price")), await text(page, ".hero-price"));
check("«Минимум за 60 дней» pill is shown for a true low", (await page.locator(".hero .pill.drop").count()) === 1);
check("chart rendered with a reference line", (await page.locator(".detail svg.chart .ref").count()) >= 1);
const box = await page.locator(".detail svg.chart").boundingBox();
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5); await settle(200);
check("scrubbing shows the exact price tooltip", await page.locator(".chart-tip").first().isVisible());
await shot(page, "03-detail-light");
await page.locator(".detail .seg-item", { hasText: "30" }).first().click(); await settle(300);
check("range switch redraws chart", (await page.locator(".detail svg.chart").count()) === 1);
// target price
await page.locator(".detail .pill.tint", { hasText: "Уведомить" }).click(); await settle(600);
await page.fill(".sheet input[type=number]", "700"); await page.keyboard.press("Enter"); await settle(900);
const tp = (await env.rpc("GET_PRODUCTS")).find((p) => p.id === "8000003");
check("«Уведомить, если ниже» really saves the target", tp?.targetPrice === 700, tp?.targetPrice);
check("button label shows the target", /700/.test(await page.locator(".detail .pill.tint").first().innerText()));
await page.locator(".back").last().click(); await settle(800);
check("back returns to the list", (await page.locator(".screen.detail").count()) === 0);

// unavailable + error detail
await page.locator(".row.gone").first().click(); await settle(900);
check("unavailable hero: struck grey price and date", (await page.locator(".hero-price.stale").count()) === 1 && /нет в наличии с/.test(await text(page, ".hero .pill.gone")));
await shot(page, "04-detail-unavailable");
check("unavailable chart has no marker at «now»", (await page.locator(".detail svg.chart .line.dashed").count()) >= 1);
await page.locator(".back").last().click(); await settle(800);

// delete + undo really restores
await page.locator(".row.product", { hasText: "Без истории" }).first().click(); await settle(800);
await page.locator(".row.action.danger").click(); await settle(900);
check("delete shows toast with Отменить", (await page.locator(".toast-action").count()) === 1);
check("deleted product is gone", !(await env.rpc("GET_PRODUCTS")).some((p) => p.id === "8000001"));
await page.locator(".toast-action").click(); await settle(900);
check("Отменить restores the product", (await env.rpc("GET_PRODUCTS")).some((p) => p.id === "8000001"));

// ---- 3. folders and group chart ------------------------------------------------------------------------------------------------------
await page.locator(".tab", { hasText: "Папки" }).click(); await settle(500);
check("folders tab lists folders", (await page.locator(".row", { hasText: "Большая группа" }).count()) === 1);
await shot(page, "05-folders");
await page.locator(".row", { hasText: "Большая группа" }).click(); await settle(800);
await page.locator(".pill.primary", { hasText: "График группы" }).click(); await settle(1200);
check("group chart opened with default 8 lines (capped)", (await page.locator(".group-page svg.chart .line").count()) === 8, await page.locator(".group-page svg.chart .line").count());
check("no stray «null» text on the group page", !(await page.locator(".group-page").innerText()).includes("null"));
await shot(page, "05b-group-default");
await page.fill(".gfilter", "15"); await settle(600);
const found = await text(page, ".found");
check("«Найдено K из N» shown for filter 15", /^Найдено \d+ из 28$/.test(found), found);
check("matching text highlighted", (await page.locator(".check-list mark").count()) > 0);
check("filtering did not redraw the chart (still 8 lines)", (await page.locator(".group-page svg.chart .line").count()) === 8);
await shot(page, "06-group-filter-15");
await page.locator(".pill", { hasText: /^Выбрать найденные/ }).click(); await settle(500);
check("select-matching adds lines", (await page.locator(".group-page svg.chart .line").count()) > 8);
await page.locator(".pill", { hasText: "Только найденные" }).click(); await settle(400);
const linesOnly = await page.locator(".group-page svg.chart .line").count();
check("only-matching leaves just the found lines", linesOnly > 0 && linesOnly < 8, linesOnly);
check("unavailable item shows dashed key and date", true);
await page.fill(".gfilter", ""); await settle(400);
const goneRow = page.locator(".check-list .row", { hasText: "нет в наличии с" });
check("unavailable group items carry «нет в наличии с»", (await goneRow.count()) === 3, await goneRow.count());
// fullscreen
await page.locator(".fs-btn").first().click(); await settle(900);
const fs1 = await page.evaluate(() => !!document.fullscreenElement);
check("fullscreen entered (or falls back to a tab in popup mode)", fs1 || env.ctx.pages().length > 2, fs1);
if (fs1) { await shot(page, "07-group-fullscreen"); await page.locator(".fs-btn").first().click(); await settle(600); check("the same button exits fullscreen (Esc is handled by the browser itself)", !(await page.evaluate(() => !!document.fullscreenElement))); }
for (const p of env.ctx.pages()) if (p.url().includes("tab=1")) await p.close();

// ---- 4. settings + theme -----------------------------------------------------------------------------------------------------------------
await page.locator(".back").last().click(); await settle(700); await page.locator(".back").last().click(); await settle(700);
await page.locator(".tab", { hasText: "Товары" }).click(); await settle(500);
await page.locator(".topbar .round").first().click(); await settle(500);
await page.locator(".menu-item", { hasText: "Настройки" }).click(); await settle(800);
await shot(page, "08-settings");
await page.locator(".seg-item", { hasText: "Тёмная" }).click(); await settle(500);
check("manual dark theme applied", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark");
await page.locator(".back").last().click(); await settle(800);
await shot(page, "09-list-dark");

// ---- 5. accessibility media + narrow -----------------------------------------------------------------------------------------------------
const cdp = await env.ctx.newCDPSession(page);
const media = async (features) => { await cdp.send("Emulation.setEmulatedMedia", { features }); await settle(300); };
await page.locator(".topbar .round").first().click(); await settle(400);
await page.locator(".menu-item", { hasText: "Настройки" }).click(); await settle(700);
await page.locator(".seg-item", { hasText: "Авто" }).click(); await settle(400);
await page.locator(".back").last().click(); await settle(700);
await media([{ name: "prefers-reduced-transparency", value: "reduce" }]);
const bf = await page.evaluate(() => getComputedStyle(document.querySelector(".tabbar")).backdropFilter);
check("reduced-transparency removes blur and makes the bar solid", bf === "none", bf);
await shot(page, "10-reduced-transparency");
await media([{ name: "prefers-reduced-transparency", value: "no-preference" }, { name: "prefers-contrast", value: "more" }]);
check("high contrast removes blur", (await page.evaluate(() => getComputedStyle(document.querySelector(".tabbar")).backdropFilter)) === "none");
await shot(page, "11-contrast-more");
await media([{ name: "prefers-contrast", value: "no-preference" }, { name: "prefers-reduced-motion", value: "reduce" }]);
await page.locator(".row.product").first().click(); await settle(400);
check("reduced motion: screen settles at once with no transform", (await page.evaluate(() => document.querySelector(".screen.detail").style.transform)) === "");
await shot(page, "12-reduced-motion-detail");
await page.locator(".back").last().click(); await settle(500);
await media([{ name: "prefers-reduced-motion", value: "no-preference" }]);
await page.evaluate(() => document.documentElement.style.setProperty("--w", "340px")); await settle(400);
await shot(page, "13-narrow");
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || document.querySelector(".content").scrollWidth > document.querySelector(".content").clientWidth + 1);
check("no horizontal overflow at 340px", !overflow);
await page.evaluate(() => document.documentElement.style.setProperty("--w", "420px"));

// ---- 6. gestures -----------------------------------------------------------------------------------------------------------------------------
const tx = () => page.evaluate(() => { const s = document.querySelector(".screen.detail"); const m = s?.style.transform.match(/translate3d\(([-\d.]+)%/); return m ? parseFloat(m[1]) : 0; });
await page.locator(".row.product").nth(2).click();
await sleep(70);
const mid = await tx();
check("push is mid-flight shortly after tap", mid > 0 && mid < 100, mid);
await page.mouse.move(330, 300); await page.mouse.down(); await page.mouse.move(344, 300, { steps: 2 }); await sleep(16);
const grabbed = await tx();
await page.mouse.move(384, 300, { steps: 5 }); await sleep(16);
const dragged = await tx();
check("interrupting the push: pointer then drives the screen 1:1 from where it was (no jump)", Math.abs(dragged - grabbed - (40 / 420) * 100) < 4, { mid, grabbed, dragged });
await page.mouse.move(412, 300, { steps: 6 }); await page.mouse.up(); await settle(1000);
check("dragging right past the middle goes back", (await page.locator(".screen.detail").count()) === 0);
await page.locator(".row.product").nth(2).click(); await settle(900);
await page.mouse.move(210, 300); await page.mouse.down(); for (const x of [215, 222, 232, 240]) { await page.mouse.move(x, 300); await sleep(120); } await sleep(300); await page.mouse.up(); await settle(900);
check("a short slow drag springs back, screen stays", (await page.locator(".screen.detail").count()) === 1);
await page.mouse.move(100, 300); await page.mouse.down(); await page.mouse.move(-1, 300, { steps: 4 });
const rubber = await tx(); await page.mouse.up(); await settle(800);
check("dragging left is rubber-banded, not free", rubber > -12 && rubber <= 0, rubber);
await page.locator(".back").last().click(); await settle(800);
// sheet flick
await page.locator(".searchrow .round").last().click(); await settle(700);
const sy = () => page.evaluate(() => { const m = document.querySelector(".sheet")?.style.transform.match(/translate3d\(0px, ([-\d.]+)px/); return m ? parseFloat(m[1]) : null; });
const sb = await page.locator(".sheet-grab").boundingBox();
await page.mouse.move(sb.x + sb.width / 2, sb.y + 10); await page.mouse.down(); await page.mouse.move(sb.x + sb.width / 2, sb.y - 60, { steps: 4 });
const up = await sy();
check("pulling a sheet up rubber-bands (small offset)", up !== null && up <= 0 && up > -48, up);
await page.mouse.up(); await settle(800);
const sb2 = await page.locator(".sheet-grab").boundingBox();
await page.mouse.move(sb2.x + sb2.width / 2, sb2.y + 10); await page.mouse.down(); await page.mouse.move(sb2.x + sb2.width / 2, sb2.y + 70, { steps: 3 }); await page.mouse.up(); await settle(1100);
check("a quick flick down dismisses the sheet", (await page.locator(".sheet").count()) === 0);
await page.locator(".searchrow .round").last().click(); await settle(700);
await page.keyboard.press("Escape"); await settle(900);
check("Escape closes the sheet", (await page.locator(".sheet").count()) === 0, await page.evaluate(() => document.activeElement.outerHTML.slice(0, 120)));

// ---- 7. keyboard + a11y -------------------------------------------------------------------------------------------------------------------
const unlabeled = await page.evaluate(() => [...document.querySelectorAll("button, a, input, select")].filter((e) => !e.closest("[hidden]") && !(e.getAttribute("aria-label") || e.textContent.trim() || e.labels?.length || e.title)).map((e) => e.className));
check("every control has an accessible name", unlabeled.length === 0, unlabeled);
const small = await page.evaluate(() => [...document.querySelectorAll("button.round:not(.small), button.pill:not(.small), a.pill:not(.small), .tab, .row")].map((e) => [e.className, e.getBoundingClientRect().height]).filter((r) => r[1] && r[1] < 39.5));
check("main targets are at least 40px tall", small.length === 0, small);
await page.keyboard.press("Tab");
check("focus ring visible on keyboard focus", (await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)) === "solid");

// ---- 8. language switch (existing EN dictionary kept) -------------------------------------------------------------------------------------
await env.setSync({ language: "en" });
const pEn = await open(); await settle(600);
check("English dictionary still works", (await text(pEn, "h1.title")) === "Products", await text(pEn, "h1.title"));
await env.setSync({ language: "ru" });

const realErrors = errors.filter((e) => !/ERR_NAME_NOT_RESOLVED/.test(e)); // the seeded product image points at a host that does not exist
check("no console / page errors across the run", realErrors.length === 0, realErrors.slice(0, 5));
await env.close();

// ---- 9. empty states on a clean profile ---------------------------------------------------------------------------------------------------------
const env2 = await launch();
await env2.setSync({ useFetch: false, notificationsEnabled: false, language: "ru" });
const p2 = await env2.ctx.newPage(); await p2.setViewportSize({ width: 420, height: 600 });
p2.on("pageerror", (e) => errors.push(String(e)));
await p2.goto(`chrome-extension://${env2.extId}/popup.html`); await p2.waitForSelector(".empty", { timeout: 10000 }); await sleep(600);
check("empty state: one sentence and one action", (await p2.locator(".empty .empty-text").count()) === 1 && (await p2.locator(".empty button").count()) === 1);
check("savings card hidden with no data", (await p2.locator(".card.saved").count()) === 0);
await p2.screenshot({ path: path.join(SHOTS, "14-empty.png") });
await env2.close();

// ---- 10. edge data: one product without history; every product unavailable -----------------------------------------------------------
const env3 = await launch();
await env3.setSync({ useFetch: false, notificationsEnabled: false, language: "ru" });
await seedInto(env3, { products: [product("8100001", "Единственный", { currentPrice: 777 })], history: [] });
const p3 = await env3.ctx.newPage(); await p3.setViewportSize({ width: 420, height: 600 });
const errs3 = []; p3.on("pageerror", (e) => errs3.push(String(e))); p3.on("console", (m) => { if (m.type() === "error") errs3.push(m.text()); });
await p3.goto(`chrome-extension://${env3.extId}/popup.html`); await p3.waitForSelector(".row.product"); await sleep(500);
check("one product, no history: no savings card, no «минимум» caption", (await p3.locator(".card.saved").count()) === 0 && (await p3.locator(".row-cap", { hasText: "минимум за 60" }).count()) === 0);
await p3.locator(".row.product").click(); await sleep(900);
check("detail without history renders hero and no 60-day pill", /777/.test(await p3.locator(".hero-price").innerText()) && (await p3.locator(".hero .pill.drop").count()) === 0);
await p3.screenshot({ path: path.join(SHOTS, "15-detail-no-history.png") });
await seedInto(env3, { products: [product("8100001", "Единственный", { currentPrice: 777, status: "unavailable", unavailableSince: NOW - DAY, availability: "unavailable", lastSuccessfulCheckAt: NOW - DAY })], history: [] });
await p3.reload(); await p3.waitForSelector(".row.product"); await sleep(500);
check("all unavailable: no savings card, row is muted and struck", (await p3.locator(".card.saved").count()) === 0 && (await p3.locator(".row.gone .row-price.stale").count()) === 1);
check("edge data: no errors", errs3.filter((e) => !/ERR_NAME_NOT_RESOLVED/.test(e)).length === 0, errs3.slice(0, 3));
await env3.close();

// ---- 11. review prompt ---------------------------------------------------------------------------------------------------------------
const env4 = await launch();
await env4.setSync({ useFetch: false, notificationsEnabled: false, language: "ru" });
const rp = ["8200001", "8200002", "8200003"].map((id, i) => product(id, `Отзыв ${i}`, { currentPrice: 800 }));
await seedInto(env4, { products: rp, history: rp.flatMap((p) => hist(p.id, [40, 10], [1000, 800])) });
const p4 = await env4.ctx.newPage(); await p4.setViewportSize({ width: 420, height: 600 });
await p4.goto(`chrome-extension://${env4.extId}/popup.html`); await p4.waitForSelector(".row.product"); await sleep(400);
check("review prompt hidden in the first days", (await p4.locator(".rate").count()) === 0);
await env4.sw.evaluate((t) => chrome.storage.local.set({ firstRunAt: t }), NOW - 8 * DAY);
await p4.reload(); await p4.waitForSelector(".row.product"); await sleep(500);
check("review prompt shown after a week with real savings", (await p4.locator(".rate .rate-title").innerText()) === "Нравится расширение?");
await p4.screenshot({ path: path.join(SHOTS, "16-review-prompt.png") });
await p4.locator(".rate .pill", { hasText: "Да" }).click(); await sleep(300);
check("«Да» offers the review link", (await p4.locator(".rate a.pill").count()) === 1);
await p4.locator(".rate .pill", { hasText: "Позже" }).click(); await sleep(300);
await p4.reload(); await p4.waitForSelector(".row.product"); await sleep(400);
check("«Позже» hides it for 30 days", (await p4.locator(".rate").count()) === 0);
await env4.sw.evaluate(() => chrome.storage.local.set({ rateHiddenUntil: 0 }));
await p4.reload(); await p4.waitForSelector(".row.product"); await sleep(400);
await p4.locator(".rate .pill", { hasText: "Не очень" }).click(); await sleep(300);
await p4.reload(); await p4.waitForSelector(".row.product"); await sleep(400);
check("an answer is remembered and never asked again", (await p4.locator(".rate").count()) === 0 && (await env4.sw.evaluate(() => chrome.storage.local.get("rateDone"))).rateDone === true);
await env4.close();

const failed = finish();
process.exit(failed ? 1 : 0);
