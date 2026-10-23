// End-to-end: the REAL background checker opens a tab on a saved page and updates the stored product. Verifies the
// unavailable / error state machine for every marketplace without a live site.
import { launch, reporter, SITES, sleep } from "./lib.mjs";

const { check, finish } = reporter("availability-flow");
const env = await launch();
await env.setSync({ useFetch: false, notificationsEnabled: false });

const SOLD = { ozon: ["soldout-widget", "soldout-ld-withprice", "soldout-text", "soldout-ld"], wb: ["soldout"], ym: ["soldout-text", "soldout-ld"] };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function open(site) { const page = await env.ctx.newPage(); await page.goto(SITES[site].url, { waitUntil: "load" }); return page; }
async function track(site) {
  env.serving[site] = "available";
  const page = await open(site);
  const snap = await env.snapshotOf(site);
  const res = await env.rpc(SITES[site].trackMsg, { snapshot: snap });
  await page.close();
  return res;
}
const get = (site) => env.rpc("GET_PRODUCT", { ozonProductId: SITES[site].productId });
const hist = async (site) => (await env.rpc("GET_HISTORY", { productId: SITES[site].productId, since: 0 })).length;
async function refresh(site, fixture) { env.serving[site] = fixture; return env.rpc("REFRESH_PRODUCT", { id: SITES[site].productId }); }

try {
  for (const site of ["ozon", "wb", "ym"]) {
    console.log(`\n=== ${site} ===`);
    const tracked = await track(site);
    check(`${site}: product tracked`, tracked && !tracked.error && tracked.currentPrice > 0, tracked);
    const p0 = await get(site), h0 = await hist(site);
    check(`${site}: new product has no unavailable state`, !p0.status || p0.status === "active", p0.status);

    // --- positive signal must be seen on 2 consecutive checks, price + history untouched
    const [s1, s2] = SOLD[site];
    await refresh(site, s1);
    let p = await get(site);
    check(`${site}: 1st sold-out signal -> only counted, still active`, p.unavailableChecks === 1 && p.status !== "unavailable" && p.trackingStatus === "active", { checks: p.unavailableChecks, status: p.status, ts: p.trackingStatus });
    await refresh(site, s1);
    p = await get(site);
    check(`${site}: 2nd consecutive signal -> status "unavailable"`, p.status === "unavailable" && typeof p.unavailableSince === "number" && p.availability === "unavailable" && p.availabilityReason === "out_of_stock", { status: p.status, since: p.unavailableSince, av: p.availability, reason: p.availabilityReason });
    check(`${site}: last real price kept, no fake history point`, p.currentPrice === p0.currentPrice && (await hist(site)) === h0, { price: p.currentPrice, was: p0.currentPrice, hist: await hist(site), h0 });
    check(`${site}: "last seen" time not moved by unavailable checks`, p.lastSuccessfulCheckAt === p0.lastSuccessfulCheckAt, { now: p.lastSuccessfulCheckAt, was: p0.lastSuccessfulCheckAt });
    const insights = await env.rpc("GET_INSIGHTS");
    check(`${site}: unavailable product excluded from insights`, !(SITES[site].productId in insights.byId), Object.keys(insights.byId));

    // second kind of sold-out page, and a page-visit style variant
    if (s2) {
      await refresh(site, s2); await refresh(site, s2);
      p = await get(site);
      check(`${site}: other sold-out markup (${s2}) keeps it unavailable, price still not overwritten`, p.status === "unavailable" && p.currentPrice === p0.currentPrice && (await hist(site)) === h0, { status: p.status, price: p.currentPrice });
    }
    // removed page
    await refresh(site, "removed");
    p = await get(site);
    check(`${site}: removed page keeps it unavailable (reason updated)`, p.status === "unavailable" && p.availabilityReason === "removed", { status: p.status, reason: p.availabilityReason });

    // --- price reappears -> normal tracking, badge state cleared
    await refresh(site, "available");
    p = await get(site);
    check(`${site}: price reappears -> back to active, state cleared`, p.status === "active" && p.unavailableSince === undefined && !p.unavailableChecks && p.availability === "available" && p.trackingStatus === "active" && p.currentPrice === p0.currentPrice, { status: p.status, since: p.unavailableSince, checks: p.unavailableChecks, av: p.availability });

    // --- ambiguous failures -> ERROR, never unavailable
    for (const bad of ["failed", "http500", "abort"]) {
      const res = await refresh(site, bad);
      p = await get(site);
      check(`${site}: ${bad} page -> error state (not unavailable)`, !!res?.error && p.trackingStatus === "error" && p.status !== "unavailable" && !p.unavailableChecks && !!p.lastError && p.errorStreak >= 1, { res, ts: p.trackingStatus, status: p.status, checks: p.unavailableChecks, streak: p.errorStreak });
      check(`${site}: ${bad} did not touch price/history`, p.currentPrice === p0.currentPrice && (await hist(site)) === h0);
    }
    await refresh(site, "available");
    p = await get(site);
    check(`${site}: error recovers on a good check`, p.trackingStatus === "active" && !p.errorStreak && !p.lastError, { ts: p.trackingStatus, streak: p.errorStreak });

    // --- a transient failure between two signals neither resets nor completes the pair
    await refresh(site, s1);
    await refresh(site, "failed");
    p = await get(site);
    check(`${site}: signal, then failure -> still not unavailable`, p.status !== "unavailable" && p.unavailableChecks === 1 && p.trackingStatus === "error", { status: p.status, checks: p.unavailableChecks, ts: p.trackingStatus });
    await refresh(site, s1);
    p = await get(site);
    check(`${site}: ...second signal after the failure -> unavailable`, p.status === "unavailable", p.status);
    await refresh(site, "available");

    // --- user visiting the page (content script) counts as an observation too
    env.serving[site] = SOLD[site][0];
    for (let visit = 1; visit <= 2; visit++) {
      const pg = await open(site); await sleep(2200); await pg.close();
      p = await get(site);
      check(`${site}: page visit #${visit} (content script) -> unavailableChecks=${visit}`, p.unavailableChecks === visit, p.unavailableChecks);
    }
    check(`${site}: two visits -> unavailable`, p.status === "unavailable", p.status);

    // --- messages are validated
    const before = JSON.stringify(await get(site));
    await env.rpc("PAGE_UNAVAILABLE", { ozonProductId: SITES[site].productId, reason: "<script>" });
    await env.rpc("PAGE_UNAVAILABLE", { ozonProductId: "../../etc/passwd", reason: "removed" });
    await env.rpc("PAGE_UNAVAILABLE", { ozonProductId: "99999999", reason: "removed" });
    check(`${site}: invalid PAGE_UNAVAILABLE messages are ignored`, JSON.stringify(await get(site)) === before);
    await refresh(site, "available");
  }

  // --- scheduler: unavailable products are re-checked about daily, normal ones on the usual cadence
  console.log("\n=== scheduler ===");
  env.serving.ozon = "available";
  const dbPut = (rec) => env.rpcPage.evaluate((r) => new Promise((res, rej) => { const o = indexedDB.open("ozon-price-tracker"); o.onsuccess = () => { const tx = o.result.transaction("products", "readwrite"); tx.objectStore("products").put(r); tx.oncomplete = () => { o.result.close(); res(true); }; tx.onerror = () => rej(tx.error); }; o.onerror = () => rej(o.error); }), rec);
  const base = (await get("ozon"));
  const old = Date.now() - 2 * 3600e3, older = Date.now() - 26 * 3600e3;
  const mk = (id, extra) => ({ ...base, id, ozonProductId: id, title: `Sched ${id}`, url: `https://www.ozon.ru/product/x-${id}/`, canonicalUrl: `https://www.ozon.ru/product/${id}/`, createdAt: Date.now() - 9e8, folderId: null, ...extra });
  await dbPut(mk("5550001", { lastCheckedAt: old, status: undefined }));
  await dbPut(mk("5550002", { lastCheckedAt: old, status: "unavailable", unavailableSince: old, unavailableChecks: 2, availability: "unavailable" }));
  await dbPut(mk("5550003", { lastCheckedAt: older, status: "unavailable", unavailableSince: older, unavailableChecks: 2, availability: "unavailable" }));
  await env.sw.evaluate(() => chrome.alarms.create("ozon-price-check", { when: Date.now() + 200 }));
  for (let i = 0; i < 60; i++) { await sleep(1000); if (!(await env.rpc("GET_STATUS")).running && i > 3) break; }
  const lc = async (id) => (await env.rpc("GET_PRODUCT", { ozonProductId: id })).lastCheckedAt;
  check("scheduler: normal product checked", (await lc("5550001")) > old + 60e3, await lc("5550001"));
  check("scheduler: unavailable product (checked 2h ago) skipped", (await lc("5550002")) === old, await lc("5550002"));
  check("scheduler: unavailable product (checked 26h ago) re-checked", (await lc("5550003")) > older + 60e3, await lc("5550003"));
  check("scheduler: forced 'check all' includes unavailable products", (await env.rpc("REFRESH_ALL")).started === true);
} finally {
  await env.close();
}
process.exit(finish() ? 1 : 0);
