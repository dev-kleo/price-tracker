// Shared helpers: launch Chromium with the unpacked extension, serve saved pages at the real marketplace hosts, call the background.
//
// The marketplace hosts are mapped to a local HTTPS fixture server with --host-resolver-rules. Per-page request interception was tried
// first and does not work: tabs created by the extension (chrome.tabs.create) start navigating before Playwright can attach.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";

export const EXT = process.env.EXT_DIR ? path.resolve(process.env.EXT_DIR) : path.resolve(import.meta.dirname, "..");
export const CHROMIUM = process.env.CHROMIUM_EXE || path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright", "chromium-1248", "chrome-win64", "chrome.exe");
export const FIXTURES = path.join(import.meta.dirname, "fixtures");

// product pages the fixtures are served under
export const SITES = {
  ozon: { host: "www.ozon.ru", url: "https://www.ozon.ru/product/elektrochaynik-1234567/", match: "https://www.ozon.ru/*", snapshotMsg: "GET_PAGE_SNAPSHOT", trackMsg: "TRACK_PRODUCT", productId: "1234567" },
  wb: { host: "www.wildberries.ru", url: "https://www.wildberries.ru/catalog/1415895532/detail.aspx", match: "https://www.wildberries.ru/*", snapshotMsg: "GET_WB_SNAPSHOT", trackMsg: "WB_TRACK", productId: "wb:1415895532" },
  ae: { host: "aliexpress.ru", url: "https://aliexpress.ru/item/1005003040504687.html?sku_id=12000027596743248", match: "https://aliexpress.ru/*", snapshotMsg: "GET_AE_SNAPSHOT", trackMsg: "AE_TRACK", productId: "ae:1005003040504687:12000027596743248" },
  ym: { host: "market.yandex.ru", url: "https://market.yandex.ru/card/kruzhka-dlya-chaya/5090882755", match: "https://market.yandex.ru/*", snapshotMsg: "GET_YM_SNAPSHOT", trackMsg: "YM_TRACK", productId: "ym:5090882755" },
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// throwaway self-signed certificate (generated once with openssl, git-ignored)
function certificate() {
  const dir = path.join(import.meta.dirname, ".certs"), key = path.join(dir, "key.pem"), cert = path.join(dir, "cert4.pem");
  if (!fs.existsSync(cert)) {
    fs.mkdirSync(dir, { recursive: true });
    const exe = [process.env.OPENSSL, "openssl", "C:/Program Files/Git/usr/bin/openssl.exe", "C:/Program Files/Git/mingw64/bin/openssl.exe"]
      .filter(Boolean).find((c) => { try { execFileSync(c, ["version"], { stdio: "ignore" }); return true; } catch { return false; } });
    if (!exe) throw new Error("openssl not found (set OPENSSL=path to openssl.exe)");
    const san = `subjectAltName=${["www.ozon.ru", "ozon.ru", "www.wildberries.ru", "wildberries.ru", "market.yandex.ru", "aliexpress.ru", "www.aliexpress.ru", "functions.yandexcloud.net"].map((h) => `DNS:${h}`).join(",")}`;
    execFileSync(exe, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "30", "-subj", "/CN=fixtures", "-addext", san],
      { stdio: "ignore", env: { ...process.env, MSYS_NO_PATHCONV: "1", MSYS2_ARG_CONV_EXCL: "*" } });
  }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

// The shipped manifest asks for AliExpress access at runtime (optional_host_permissions), which an automated browser cannot approve.
// For tests that need AliExpress, run a temporary copy of the extension where those hosts are granted at install time. The code under test is identical.
export function extensionWithAliExpress() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pt-ext-"));
  const skip = new Set(["tests", ".git", "docs", "github-profile", "node_modules", ".impeccable"]);
  fs.cpSync(EXT, dir, { recursive: true, filter: (src) => !skip.has(path.relative(EXT, src).split(path.sep)[0]) });
  const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  m.host_permissions.push(...m.optional_host_permissions); delete m.optional_host_permissions;
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(m, null, 2));
  return dir;
}

export async function launch({ headless = true, grantAe = false, reuse = null } = {}) {
  const extDir = reuse?.extDir ?? (grantAe ? extensionWithAliExpress() : EXT);
  const userDataDir = reuse?.userDataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "pt-e2e-"));
  // which saved page each marketplace currently serves ("abort" = connection dropped, "http500" = empty server error)
  // Stand-in for the shared-history API (the real one is never contacted by the tests). Mirrors its documented rules.
  const api = { posts: [], gets: [], rows: {}, mode: "ok", preflights: 0 };
  const apiHandler = (req, res) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "Content-Type" };
    const json = (code, body) => { res.writeHead(code, { "content-type": "application/json", ...cors }); res.end(JSON.stringify(body)); };
    if (req.method === "OPTIONS") { api.preflights++; res.writeHead(204, cors); return res.end(); }
    const url = new URL(req.url, "https://x");
    if (req.method === "GET") {
      if (api.mode === "hang") return;   // never answers: the extension must give up on its own
      if (api.mode === "500") return json(500, { error: "boom" });
      const store = url.searchParams.get("store"), id = url.searchParams.get("product_id");
      api.gets.push({ store, id });
      if (!["wb", "ozon", "ym", "ali"].includes(store) || !/^[A-Za-z0-9_-]{1,40}$/.test(id ?? "")) return json(400, { error: "bad params" });
      return json(200, api.rows[`${store}:${id}`] ?? []);
    }
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      let j; try { j = JSON.parse(body); } catch { return json(400, { error: "bad json" }); }
      api.posts.push({ body: j, keys: Object.keys(j).sort(), contentType: req.headers["content-type"], cookie: req.headers.cookie ?? null, referer: req.headers.referer ?? null });
      if (api.mode === "hang") return;
      if (api.mode === "500") return json(500, { error: "boom" });
      if (!["wb", "ozon", "ym", "ali"].includes(j.store) || !/^[A-Za-z0-9_-]{1,40}$/.test(String(j.product_id)) || !Number.isInteger(j.price) || j.price < 1) return json(400, { error: "bad params" });
      if (api.mode === "422") return json(422, { error: "price out of range" });
      return json(200, { saved: true });
    });
  };
  const serving = { ozon: "available", wb: "available", ym: "available", ae: "variant" };
  const hostToSite = { "www.ozon.ru": "ozon", "ozon.ru": "ozon", "www.wildberries.ru": "wb", "wildberries.ru": "wb", "market.yandex.ru": "ym", "aliexpress.ru": "ae", "www.aliexpress.ru": "ae" };
  const server = https.createServer(certificate(), (req, res) => {
    const host = String(req.headers.host).replace(/:\d+$/, "");
    if (host === "functions.yandexcloud.net") return apiHandler(req, res);
    const site = hostToSite[host];
    if (!site || /\.(png|jpe?g|gif|webp|svg|ico|css|js|json|woff2?)(\?|$)/i.test(req.url)) { res.writeHead(204); return res.end(); }
    const which = serving[site];
    if (which === "abort") return req.socket.destroy();
    if (which === "http500") { res.writeHead(500, { "content-type": "text/html" }); return res.end("<html><body>Internal Server Error</body></html>"); }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(path.join(FIXTURES, site, `${which}.html`)));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const rules = [...Object.keys(hostToSite), "functions.yandexcloud.net"].map((h) => `MAP ${h} 127.0.0.1:${port}`).join(",");
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    executablePath: CHROMIUM, headless, viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true,
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, "--no-first-run", "--no-default-browser-check", `--host-resolver-rules=${rules}`, "--ignore-certificate-errors", "--no-proxy-server"], // no system proxy: it would bypass the host mapping
  });
  let sw = ctx.serviceWorkers().find((w) => w.url().endsWith("/assets/background.js"));
  if (!sw) sw = await ctx.waitForEvent("serviceworker", { predicate: (w) => w.url().endsWith("/assets/background.js"), timeout: 20000 });
  const extId = new URL(sw.url()).host;
  // a plain extension page used as the RPC endpoint (chrome.runtime.sendMessage -> background)
  const rpcPage = await ctx.newPage();
  await rpcPage.goto(`chrome-extension://${extId}/offscreen.html`);
  const rpc = (type, payload = {}) => rpcPage.evaluate(([t, p]) => chrome.runtime.sendMessage({ type: t, ...p }), [type, payload]);
  // ask the content script of an open marketplace tab
  const snapshotOf = async (site) => {
    const s = SITES[site];
    for (let i = 0; i < 30; i++) {
      try { return await sw.evaluate(async ([match, msg]) => { const [tab] = await chrome.tabs.query({ url: match }); return chrome.tabs.sendMessage(tab.id, { type: msg }); }, [s.match, s.snapshotMsg]); }
      catch { await sleep(200); }
    }
    throw new Error(`content script for ${site} never answered`);
  };
  const close = async ({ keep = false } = {}) => { try { await ctx.close(); } finally { server.close(); if (!keep) { fs.rmSync(userDataDir, { recursive: true, force: true }); if (grantAe || reuse) fs.rmSync(extDir, { recursive: true, force: true }); } } };
  return { api, userDataDir, extDir, ctx, sw, extId, rpc, rpcPage, serving, snapshotOf, close, setSync: (o) => sw.evaluate((x) => chrome.storage.sync.set(x), o) };
}

// tiny assertion collector
export function reporter(name) {
  const results = [];
  const check = (label, cond, detail) => { results.push({ label, pass: !!cond, ...(cond ? {} : { detail }) }); console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : `   -> ${JSON.stringify(detail)}`}`); };
  const finish = () => {
    const failed = results.filter((r) => !r.pass);
    fs.mkdirSync(path.join(import.meta.dirname, "results"), { recursive: true });
    fs.writeFileSync(path.join(import.meta.dirname, "results", `${name}.json`), JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
    console.log(`\n${name}: ${results.length - failed.length}/${results.length} passed${failed.length ? `, ${failed.length} FAILED` : ""}`);
    return failed.length;
  };
  return { check, finish };
}
