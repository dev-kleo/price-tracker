// AliExpress adapter end-to-end: variants, public price only, SPA price changes with debounce, unavailable/removed/blocked, optional-permission
// registration, export/import. Runs a temporary copy of the extension in which the optional AliExpress hosts are granted at install time
// (an automated browser cannot press the permission prompt); the code under test is the same.
import { launch, reporter, sleep } from "./lib.mjs";

const { check, finish } = reporter("aliexpress");
let env = await launch({ grantAe: true });
await env.setSync({ useFetch: false, notificationsEnabled: false });
const URL_ = (sku) => `https://aliexpress.ru/item/1005003040504687.html${sku ? `?sku_id=${sku}` : ""}`;
const SKU = { "1M": "12000027596743248", "2M": "12000027596743249", "3M": "12000027596743250" };
const ID = (k) => `ae:1005003040504687:${SKU[k]}`;
const open = async (url, fixture = "variant") => { env.serving.ae = fixture; const p = await env.ctx.newPage(); await p.goto(url, { waitUntil: "load" }); return p; };
const get = (id) => env.rpc("GET_PRODUCT", { ozonProductId: id });
const hist = async (id) => (await env.rpc("GET_HISTORY", { productId: id, since: 0 })).length;
const refresh = async (id, fixture) => { env.serving.ae = fixture; return env.rpc("REFRESH_PRODUCT", { id }).catch((e) => ({ error: String(e) })); };
// the page needs a few seconds to settle (its own sku_id write, the grace period), so ask until it answers with a snapshot
const snapshotOf = async () => { for (let i = 0; i < 40; i++) { const r = await env.snapshotOf("ae"); if (r) return r; await sleep(300); } throw new Error("no snapshot"); };
const registered = () => env.sw.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).map((s) => ({ id: s.id, matches: s.matches, persist: s.persistAcrossSessions })));

try {
  // ---- 0. the content script is registered while access is granted ----
  const reg = await registered();
  check("content script registered dynamically (persistAcrossSessions)", reg.length === 1 && reg[0].id === "ae" && reg[0].persist === true && reg[0].matches.includes("https://aliexpress.ru/*"), reg);
  check("granted access is visible to the worker", await env.sw.evaluate(() => chrome.permissions.contains({ origins: ["https://aliexpress.ru/*", "https://www.aliexpress.ru/*"] })));

  // ---- 1. variant page: id, variant, public price ----
  let page = await open(URL_(SKU["1M"]));
  let snap = await snapshotOf();
  console.log("EXTRACTED variant page:", JSON.stringify({ ...snap, imageUrl: snap.imageUrl?.slice(0, 40) + "..." }));
  check("variant: id carries item and sku", snap.ozonProductId === ID("1M"), snap.ozonProductId);
  check("variant: title, price and canonical url", snap.title.startsWith("Кабель USB Type-C") && snap.price.value === 182 && snap.canonicalUrl === URL_(SKU["1M"]), snap);
  check("variant: label lists the selected options", snap.variantLabel === "Цвет: Black For Type C · Длина: 1M", snap.variantLabel);
  check("variant: https image", snap.imageUrl?.startsWith("https://"), snap.imageUrl);
  const t1 = await env.rpc("AE_TRACK", { snapshot: snap });
  check("tracked as store ae with variant label", t1.store === "ae" && t1.variantLabel === "Цвет: Black For Type C · Длина: 1M" && t1.currentPrice === 182, t1);

  // ---- 2. variant click in the SPA: other variant, other price, other history ----
  await env.sw.evaluate(() => { globalThis.__aeObs = 0; chrome.runtime.onMessage.addListener((m) => { if (m?.type === "AE_OBSERVATION") globalThis.__aeObs++; }); });
  for (const k of ["2M", "3M", "2M", "3M", "2M"]) { await page.locator("#len button", { hasText: k }).click(); await sleep(60); } // a burst of clicks
  await sleep(2600);
  const obs = await env.sw.evaluate(() => globalThis.__aeObs);
  check("burst of variant clicks is debounced (at most 2 observations for 5 clicks)", obs <= 2, obs);
  snap = await snapshotOf();
  check("after the click the snapshot is the 2M variant at its own price", snap.ozonProductId === ID("2M") && snap.price.value === 231 && snap.variantLabel.endsWith("Длина: 2M"), snap);
  const a = await get(ID("1M"));
  check("the tracked 1M variant is untouched by the page showing 2M", a.currentPrice === 182 && (await hist(ID("1M"))) === 1, a);
  const t2 = await env.rpc("AE_TRACK", { snapshot: snap });
  check("2M tracked as a separate item with its own history", t2.id === ID("2M") && t2.currentPrice === 231 && (await hist(ID("2M"))) === 1);
  await page.close();

  // ---- 3. no sku in the URL: the page writes the default variant itself ----
  page = await open(URL_(null));
  snap = await snapshotOf();
  check("opened without sku_id: waits for the page's own default variant", snap.ozonProductId === ID("1M") && snap.price.value === 182, snap.ozonProductId);
  await page.close();
  // ---- 3b. a page that never exposes a variant: product-level fallback ----
  page = await open(URL_(null), "nosku");
  snap = await snapshotOf();
  check("no variant on the page: falls back to the product-level id", snap.ozonProductId === "ae:1005003040504687" && snap.variantLabel === null && snap.price.value === 182, snap);
  await page.close();

  // ---- 4. only the public price is recorded ----
  page = await open("https://aliexpress.ru/item/1005012123154946.html?sku_id=12000058034790509", "single");
  snap = await snapshotOf();
  console.log("EXTRACTED single-variant page:", JSON.stringify({ ...snap, imageUrl: "..." }));
  check("coupon price (120 132) is ignored, displayed price 133 735 is recorded", snap.price.value === 133735, snap.price);
  await page.close();

  // ---- 5. refresh by the background checker ----
  let r = await refresh(ID("1M"), "variant");
  check("background refresh of a variant item succeeds", !r.error && r.currentPrice === 182 && r.id === ID("1M"), r);
  r = await refresh(ID("2M"), "variant");
  check("background refresh opens the saved variant (2M -> 231), not the default", !r.error && r.currentPrice === 231, r);

  // ---- 6. unavailable handling is reused ----
  await refresh(ID("1M"), "soldout"); let p = await get(ID("1M"));
  check("sold-out signal: counted once, still active", p.unavailableChecks === 1 && p.status !== "unavailable", { c: p.unavailableChecks, s: p.status });
  await refresh(ID("1M"), "soldout"); p = await get(ID("1M"));
  check("2nd consecutive sold-out: status unavailable, price + history kept", p.status === "unavailable" && p.currentPrice === 182 && (await hist(ID("1M"))) === 1 && typeof p.unavailableSince === "number", p);
  await refresh(ID("1M"), "variant"); p = await get(ID("1M"));
  check("price visible again: back to tracking", p.status === "active" && p.unavailableChecks === 0 && p.currentPrice === 182, p);
  // removed page opened by the user: every tracked variant of the item is flagged
  page = await open("https://aliexpress.ru/item/1005003040504687.html", "removed"); await sleep(2500); await page.close();
  const pa = await get(ID("1M")), pb = await get(ID("2M"));
  check("404 page flags every tracked variant of the item", pa.unavailableChecks >= 1 && pb.unavailableChecks >= 1, { a: pa.unavailableChecks, b: pb.unavailableChecks });
  await refresh(ID("2M"), "variant");
  // ---- 7. bot check and broken page -> errors, never "unavailable" ----
  await refresh(ID("2M"), "blocked"); p = await get(ID("2M"));
  check("bot check becomes an error, not unavailable", p.trackingStatus === "error" && p.status !== "unavailable" && /капч|проверк/i.test(p.lastError ?? ""), { ts: p.trackingStatus, e: p.lastError, s: p.status });
  await refresh(ID("2M"), "failed"); p = await get(ID("2M"));
  check("empty page becomes an error", p.trackingStatus === "error" && p.status !== "unavailable", p.trackingStatus);
  await refresh(ID("2M"), "variant");

  // ---- 8. export / import keeps AliExpress items ----
  const dump = await env.rpc("EXPORT_DATA");
  for (const k of ["1M", "2M"]) await env.rpc("UNTRACK_PRODUCT", { id: ID(k) });
  const imp = await env.rpc("IMPORT_DATA", { data: dump });
  const back1 = await get(ID("1M"));
  check("import restores AliExpress items with store and variant label", back1?.store === "ae" && back1.variantLabel?.includes("Длина: 1M") && imp.products >= 2, { s: back1?.store, imp });
  await env.rpc("IMPORT_DATA", { data: { products: [{ ...back1, id: "ae:123", ozonProductId: "ae:123" }, { ...back1, id: ID("3M"), ozonProductId: ID("3M"), canonicalUrl: "https://evil.example/item/1.html", url: "https://evil.example/item/1.html" }], history: [] } }).catch(() => {});
  check("import rejects malformed ids and foreign hosts", !(await get("ae:123")) && !(await get(ID("3M"))));
  // ---- 9. registration survives a browser restart / update: remove it, restart the browser on the same profile, expect it back ----
  await env.sw.evaluate(async () => { await chrome.scripting.unregisterContentScripts({ ids: ["ae"] }); });
  check("script can be removed (what happens when the user revokes access)", (await registered()).length === 0);
  const profile = { userDataDir: env.userDataDir, extDir: env.extDir };
  await env.close({ keep: true });
  env = await launch({ grantAe: true, reuse: profile });
  await sleep(800);
  const afterRestart = await registered();
  check("registration is restored after a browser restart", afterRestart.length === 1 && afterRestart[0].id === "ae", afterRestart);
  const still = await env.rpc("GET_PRODUCT", { ozonProductId: ID("1M") });
  check("tracked AliExpress items survive the restart", still?.store === "ae", still?.id);
} catch (e) {
  console.error("TEST ERROR", e);
  check("test run finished without an exception", false, String(e).slice(0, 300));
} finally {
  const failed = finish();
  await env.close();
  process.exit(failed ? 1 : 0);
}
