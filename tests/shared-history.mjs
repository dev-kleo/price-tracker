// Shared price history (opt-in): what is sent and when, throttling, failure handling, history merge, welcome page and first-run states.
// The API is a local stand-in (lib.mjs): the real endpoint is never contacted and no test data is ever POSTed to it.
import { launch, reporter, SITES, sleep } from "./lib.mjs";

const { check, finish } = reporter("shared-history");
let env = await launch({ grantAe: true });
const sync = (o) => env.setSync(o);
const SEND_MS = 2600; // content script debounce (0.6-0.9 s) + worker + request
await sync({ useFetch: false, notificationsEnabled: false, language: "ru" });

// --- the welcome tab opens on a fresh install, and only then ---
let welcome = null;
for (let i = 0; i < 20 && !welcome; i++) { welcome = env.ctx.pages().find((p) => p.url().endsWith("/welcome.html")); if (!welcome) await sleep(300); }
check("welcome page opens on a fresh install", !!welcome, env.ctx.pages().map((p) => p.url()));
if (welcome) {
  await welcome.waitForSelector(".steps li");
  const visible = (sel) => welcome.locator(sel).locator("visible=true").count();
  check("page 1 shows «1 / 2»", (await welcome.locator(".indicator").innerText()) === "1 / 2");
  const steps = await welcome.locator(".steps li").allInnerTexts();
  check("page 1 keeps the 3 steps", steps.length === 3 && /Откройте любой товар/.test(steps[0]) && /Нажмите «Отслеживать цену»/.test(steps[1]) && /сообщим, когда она упадёт/.test(steps[2]), steps);
  check("page 1 has «Далее», «Пропустить» and the sample button", (await welcome.getByRole("button", { name: "Далее" }).isVisible()) && (await welcome.getByRole("button", { name: "Пропустить" }).first().isVisible()) && (await welcome.locator("a.pill", { hasText: "Открыть пример товара" }).isVisible()));
  check("sample button opens a real store product", (await welcome.locator("a.pill", { hasText: "Открыть пример товара" }).getAttribute("href")).startsWith("https://www.wildberries.ru/catalog/"));
  check("page 1 has no sharing switch (only one switch exists, on page 2)", (await visible("input[role=switch]")) === 0 && (await welcome.locator("input[role=switch]").count()) === 1);
  check("no «Назад» on page 1", (await visible(".back")) === 0);

  await welcome.getByRole("button", { name: "Далее" }).click();
  check("page 2 shows «2 / 2» and the title «История цены»", (await welcome.locator(".indicator").innerText()) === "2 / 2" && (await welcome.locator("h1:visible").innerText()) === "История цены");
  const paras = await welcome.locator(".text p").allInnerTexts();
  check("page 2 text is exactly the agreed copy", JSON.stringify(paras) === JSON.stringify([
    "История цены начинается с того момента, как вы начали отслеживать товар.",
    "Если включить обмен ценами, вы поможете улучшить расширение: собранные цены помогают показывать историю, даже если вы только что добавили товар.",
    "Отправляются только магазин, номер товара и цена. Никаких личных данных. Отключить можно в любой момент в настройках."]), paras);
  check("page 2: switch «Делиться ценами» is OFF by default", (await welcome.locator(".switch-row").innerText()).trim() === "Делиться ценами" && !(await welcome.locator("#share").isChecked()));
  check("page 2 has «Назад», «Готово» and «Пропустить»", (await welcome.getByRole("button", { name: "Назад" }).isVisible()) && (await welcome.getByRole("button", { name: "Готово" }).isVisible()) && (await welcome.getByRole("button", { name: "Пропустить" }).first().isVisible()));
  check("opening the pages and looking at the switch made no request to the API", env.api.posts.length === 0 && env.api.gets.length === 0, { p: env.api.posts.length, g: env.api.gets.length });
  await welcome.screenshot({ path: "results/shots/25-welcome-page2.png" });

  await welcome.locator(".switch-row").click(); await sleep(300);
  check("the switch turns the shared setting on (same key as Settings)", (await env.sw.evaluate(() => chrome.storage.sync.get("sharedHistory"))).sharedHistory === true);
  await env.sw.evaluate(() => chrome.storage.sync.set({ sharedHistory: false })); await sleep(300);
  check("a change made elsewhere (Settings) shows up in the switch", !(await welcome.locator("#share").isChecked()));
  await welcome.getByRole("button", { name: "Назад" }).click();
  check("«Назад» returns to page 1 (1 / 2)", (await welcome.locator(".indicator").innerText()) === "1 / 2" && (await welcome.locator(".steps").isVisible()));
  await welcome.getByRole("button", { name: "Далее" }).click();
  check("the switch keeps its state when moving between pages", !(await welcome.locator("#share").isChecked()));
  await welcome.locator(".switch-row").click(); await sleep(200);
  await welcome.getByRole("button", { name: "Готово" }).click();
  await sleep(600);
  check("«Готово» saves the choice and closes the welcome tab", welcome.isClosed() && (await env.sw.evaluate(() => chrome.storage.sync.get("sharedHistory"))).sharedHistory === true);
  await env.sw.evaluate(() => chrome.storage.sync.remove("sharedHistory"));

  // «Пропустить» on page 1 and on page 2: same ending as «Готово», sharing stays off
  for (const onPage2 of [false, true]) {
    const w = await env.ctx.newPage(); await w.goto(`chrome-extension://${env.extId}/welcome.html`); await w.waitForSelector(".steps");
    if (onPage2) await w.getByRole("button", { name: "Далее" }).click();
    await w.getByRole("button", { name: "Пропустить" }).locator("visible=true").click(); await sleep(400);
    check(`«Пропустить» on page ${onPage2 ? 2 : 1} saves "off" and leaves sharing off`, (await env.sw.evaluate(() => chrome.storage.sync.get("sharedHistory"))).sharedHistory === false);
    await env.sw.evaluate(() => chrome.storage.sync.remove("sharedHistory")); await w.close().catch(() => {});
  }
  // English strings
  await sync({ language: "en" });
  const we = await env.ctx.newPage(); await we.goto(`chrome-extension://${env.extId}/welcome.html`); await we.waitForSelector(".steps");
  await we.getByRole("button", { name: "Next" }).click();
  check("English: page 2 title, switch and buttons", (await we.locator("h1:visible").innerText()) === "Price history" && (await we.locator(".switch-row").innerText()).trim() === "Share prices" && (await we.getByRole("button", { name: "Back" }).isVisible()) && (await we.getByRole("button", { name: "Done" }).isVisible()));
  await we.close(); await sync({ language: "ru" });
}

const posts = () => env.api.posts;
async function open(site, fixture, url = SITES[site].url) { env.serving[site] = fixture; const p = await env.ctx.newPage(); await p.goto(url, { waitUntil: "load" }); await sleep(SEND_MS); await p.close(); }
const reset = async () => { env.api.posts.length = 0; env.api.mode = "ok"; await env.sw.evaluate(() => chrome.storage.local.remove(["spSent", "spCache"])); };

// ---- 1. opt-in: nothing is sent while sharing is off ----
await sync({ sharedHistory: false }); await reset();
await open("wb", "available");
check("sharing off: no request is made", posts().length === 0, posts());

// ---- 2. what a POST contains ----
await sync({ sharedHistory: true }); await reset();
await open("wb", "available");
check("page open sends exactly one POST", posts().length === 1, posts().length);
const b = posts()[0];
console.log("POST body:", JSON.stringify(b?.body));
check("body is {store, product_id, price} and nothing else", b && JSON.stringify(b.keys) === JSON.stringify(["price", "product_id", "store"]) && b.body.store === "wb" && b.body.product_id === "1415895532" && b.body.price === 1024, b);
check("price is an integer number of rubles", Number.isInteger(b?.body.price));
check("JSON content type, no cookies, no referrer", b.contentType?.includes("application/json") && b.cookie === null && b.referer === null, b);
check("a CORS preflight was answered (no host permission needed)", env.api.preflights >= 1);

// ---- 3. throttle ----
await open("wb", "available");
check("same price again within 6 h: not sent again", posts().length === 1, posts().length);
await open("wb", "cheaper");
check("price changed: sent immediately", posts().length === 2 && posts()[1].body.price === 999, posts().map((x) => x.body.price));
await env.sw.evaluate(() => chrome.storage.local.get("spSent").then(({ spSent }) => { for (const k of Object.keys(spSent)) spSent[k][1] -= 7 * 3600e3; return chrome.storage.local.set({ spSent }); }));
await open("wb", "cheaper");
check("after 6 h the same price is sent again", posts().length === 3, posts().length);

// ---- 4. never sent: unavailable, parse failure ----
await reset();
await open("wb", "soldout"); await open("wb", "failed");
check("sold-out page and unparsable page send nothing", posts().length === 0, posts());

// ---- 5. public price only ----
await reset();
await open("ozon", "card");
check("Ozon with card price: the price WITHOUT the card is sent (1499, not 1399)", posts().length === 1 && posts()[0].body.price === 1499 && posts()[0].body.store === "ozon" && posts()[0].body.product_id === "1234567", posts());
await reset();
await open("ozon", "available");
check("Ozon without card price: the displayed price is sent", posts().length === 1 && posts()[0].body.price === 1499, posts());
await reset();
await open("ym", "pay");
check("Yandex Market with a Yandex Pay price: nothing is sent", posts().length === 0, posts());
await open("ym", "available");
check("Yandex Market normal price: store ym, numeric id", posts().length === 1 && posts()[0].body.store === "ym" && posts()[0].body.product_id === "5090882755" && posts()[0].body.price === 127, posts());
await reset();
await open("ae", "variant");
check("AliExpress: store ali, id is item-sku", posts().length === 1 && posts()[0].body.store === "ali" && posts()[0].body.product_id === "1005003040504687-12000027596743248" && posts()[0].body.price === 182, posts());

// ---- 6. failures never break anything ----
await reset(); env.api.mode = "422";
await open("wb", "available"); await open("wb", "available");
check("422 is not retried", posts().length === 1, posts().length);
await reset(); env.api.mode = "500";
await open("wb", "available"); await open("wb", "available");
check("a server error is retried on the next page open", posts().length === 2, posts().length);
await reset(); env.api.mode = "hang";
const t0 = Date.now();
const page = await env.ctx.newPage(); await page.goto(SITES.wb.url, { waitUntil: "load" }); await sleep(SEND_MS);
const title = await page.title();
check("a request that never answers does not block the page", /Кружка/.test(title) && Date.now() - t0 < 9000, title);
await page.close(); await sleep(7500);                                     // the 8 s timeout fires
const alive = await Promise.race([env.rpc("GET_STATUS"), sleep(4000).then(() => "timeout")]);
check("after the 8 s timeout the extension still answers", alive && alive !== "timeout", alive);
const kept = await env.sw.evaluate(() => chrome.storage.local.get("spSent").then((x) => Object.keys(x.spSent ?? {})));
check("a timed-out send is forgotten so it can be retried", kept.length === 0, kept);
env.api.mode = "ok";

// ---- 7. reading the shared history ----
await reset(); await sync({ sharedHistory: true });
const T = Date.now();
env.api.rows["wb:1415895532"] = [{ ts: new Date(T - 3 * 864e5).toISOString(), price: 1100 }, { ts: new Date(T - 2 * 864e5).toISOString(), price: 1050 }, { ts: new Date(T - 864e5).toISOString(), price: 1024 }];
let rows = await env.rpc("GET_SHARED_HISTORY", { id: "wb:1415895532" });
check("shared history comes back as timestamped points, oldest first", rows.length === 3 && rows[0].price === 1100 && rows[0].timestamp < rows[2].timestamp && rows.every((r) => r.priceKind === "unknown"), rows);
await env.rpc("GET_SHARED_HISTORY", { id: "wb:1415895532" });
check("second read within the cache window does not hit the network", env.api.gets.length === 1, env.api.gets.length);
check("only store and product_id are in the request", JSON.stringify(env.api.gets[0]) === JSON.stringify({ store: "wb", id: "1415895532" }), env.api.gets[0]);
await env.sw.evaluate(() => chrome.storage.local.get("spCache").then(({ spCache }) => { for (const k of Object.keys(spCache)) spCache[k].ts -= 4 * 3600e3; return chrome.storage.local.set({ spCache }); }));
env.api.mode = "500";
rows = await env.rpc("GET_SHARED_HISTORY", { id: "wb:1415895532" });
check("when the server fails the stale cache is used", rows.length === 3, rows.length);
env.api.mode = "ok";
await sync({ sharedHistory: false });
rows = await env.rpc("GET_SHARED_HISTORY", { id: "wb:1415895532" });
check("sharing off: nothing is read either", rows.length === 0, rows.length);
await sync({ sharedHistory: true });
check("invalid product id never reaches the API", (await env.rpc("GET_SHARED_HISTORY", { id: "wb:12 34/../x" })).length === 0 && !env.api.gets.some((g) => String(g.id).includes("/")));

// ---- 8. merged chart + empty state in the popup ----
await sync({ sharedHistory: true }); await reset();
const wbPage = await env.ctx.newPage(); env.serving.wb = "available"; await wbPage.goto(SITES.wb.url, { waitUntil: "load" });
const snap = await env.snapshotOf("wb"); await env.rpc("WB_TRACK", { snapshot: snap }); await wbPage.close();
const local = await env.rpc("GET_HISTORY", { productId: "wb:1415895532", since: 0 });
check("tracked product has one local point", local.length === 1, local.length);
await env.sw.evaluate(() => chrome.storage.sync.set({ sharedHistory: false }));
const popup = await env.ctx.newPage(); await popup.setViewportSize({ width: 420, height: 600 });
await popup.goto(`chrome-extension://${env.extId}/popup.html`); await popup.waitForSelector(".row.product");
await popup.locator(".row.product").click(); await sleep(1200);
check("one point only: explanatory empty state instead of a blank chart", (await popup.locator(".chartcard .hint-text").innerText()) === "История цены начнёт собираться с момента добавления. Первые данные — через 24 часа");
await popup.close();
// the same product with shared history on; one shared point has the SAME timestamp as the local one (must be merged, not doubled)
env.api.rows["wb:1415895532"] = [{ ts: new Date(local[0].timestamp - 3 * 864e5).toISOString(), price: 1100 }, { ts: new Date(local[0].timestamp - 864e5).toISOString(), price: 1050 }, { ts: new Date(local[0].timestamp).toISOString(), price: local[0].price }];
await env.sw.evaluate(() => chrome.storage.sync.set({ sharedHistory: true }));
const popup2 = await env.ctx.newPage(); await popup2.setViewportSize({ width: 420, height: 600 });
await popup2.goto(`chrome-extension://${env.extId}/popup.html`); await popup2.waitForSelector(".row.product");
await popup2.locator(".row.product").click(); await sleep(1500);
const pts = await popup2.evaluate(() => document.querySelector(".chartcard svg.chart polyline.line")?.getAttribute("points").trim().split(/\s+/).length ?? 0);
check("merged chart: 3 unique points (the shared point with the local timestamp is not doubled)", pts === 3, pts);
await popup2.screenshot({ path: "results/shots/19-merged-history.png" });
await popup2.close();

// ---- 9. first-run states in the popup ----
await env.rpc("UNTRACK_PRODUCT", { id: "wb:1415895532" });
const tabState = async (kind) => {
  const pg = await env.ctx.newPage(); await pg.setViewportSize({ width: 420, height: 600 });
  if (kind === "store") await pg.addInitScript(() => { chrome.tabs.query = async () => [{ url: "https://www.wildberries.ru/catalog/1/detail.aspx" }]; });
  await pg.goto(`chrome-extension://${env.extId}/popup.html`); await pg.waitForSelector(".empty"); await sleep(400);
  const out = { text: await pg.locator(".empty-text").innerText(), chips: await pg.locator(".empty .chip").allInnerTexts(), buttons: await pg.locator(".empty button").count() };
  if (kind === "other") await pg.screenshot({ path: "results/shots/20-empty-unsupported.png" });
  await pg.close(); return out;
};
const other = await tabState("other"), store = await tabState("store");
check("unsupported page: «Откройте товар на Ozon, Wildberries, Яндекс Маркете или AliExpress, чтобы начать отслеживание»", other.text === "Откройте товар на Ozon, Wildberries, Яндекс Маркете или AliExpress, чтобы начать отслеживание", other.text);
check("empty state shows the four store chips and one action", JSON.stringify(other.chips) === JSON.stringify(["Ozon", "Wildberries", "Яндекс Маркет", "AliExpress"]) && other.buttons === 1, other);
check("on a supported store page the empty state says what to press", store.text === "Нажмите «Отслеживать цену» на странице товара.", store.text);

// ---- 10. ask once: the card in the popup (existing users) ----
await env.sw.evaluate(() => chrome.storage.sync.remove("sharedHistory"));
const prod = await env.ctx.newPage(); env.serving.wb = "available"; await prod.goto(SITES.wb.url, { waitUntil: "load" }); await env.rpc("WB_TRACK", { snapshot: await env.snapshotOf("wb") }); await prod.close();
const ask = await env.ctx.newPage(); await ask.setViewportSize({ width: 420, height: 600 });
await ask.goto(`chrome-extension://${env.extId}/popup.html`); await ask.waitForSelector(".row.product"); await sleep(400);
check("undecided users see the one-time question", (await ask.locator(".rate-title", { hasText: "Общая история цен" }).count()) === 1);
await ask.screenshot({ path: "results/shots/21-shared-card.png" });
await ask.locator(".card.rate .pill", { hasText: "Не сейчас" }).click(); await sleep(400);
check("«Не сейчас» is remembered as OFF and the card goes away", (await env.sw.evaluate(() => chrome.storage.sync.get("sharedHistory"))).sharedHistory === false && (await ask.locator(".card.rate").count()) === 0);
await ask.locator(".topbar .round").first().click(); await sleep(300); await ask.locator(".menu-item", { hasText: "Настройки" }).click(); await sleep(800);
check("Settings has the switch, off", (await ask.locator("input[role=switch]").nth(3).isChecked().catch(() => null)) !== null && (await ask.locator(".row", { hasText: "Делиться ценами" }).count()) === 1);
await ask.locator(".row", { hasText: "Делиться ценами" }).click(); await sleep(400);
check("switching it on in Settings is saved", (await env.sw.evaluate(() => chrome.storage.sync.get("sharedHistory"))).sharedHistory === true);
await ask.close();

// ---- 11. welcome page only on install, not on update ----
// A browser started with --load-extension reports "install" on every start, so a restart cannot show the difference here;
// the Web Store reports "update" for upgrades. The guard is therefore checked in the source of the worker.
import fs from "node:fs";
const bgSrc = fs.readFileSync(new URL("../assets/background.js", import.meta.url), "utf8");
check('welcome tab is created only when onInstalled reason === "install"', /onInstalled\.addListener\(d=>\{[^}]*d&&d\.reason==="install"&&chrome\.tabs\.create\(\{url:chrome\.runtime\.getURL\("welcome\.html"\)\}\)/.test(bgSrc));

const failed = finish();
await env.close();
process.exit(failed ? 1 : 0);
