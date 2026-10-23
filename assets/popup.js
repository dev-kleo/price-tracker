import { STR } from "./i18n.js";
import { setLang, money, pct, dateShort, dateLong, dateTime, minutesAgo, highlight } from "./format.js";
import { Spring, drag, project, rubber, clamp, pressFeedback, elastic, countUp, openSheet, openPopover, toast, reduced } from "./motion.js";
import { renderChart } from "./charts.js";
import { h, icon, roundButton, segmented, switchRow, numberRow, group, sectionTitle, emptyState, skeletonRows } from "./ui.js";

/* =============================================================== constants */
const DAY = 864e5;
const IN_TAB = new URLSearchParams(location.search).has("tab");
const SIZE_LIMITS = { minW: 340, maxW: 800, minH: 400, maxH: 600 }; // Chrome caps popups at 800x600
const DEFAULT_SIZE = { w: 420, h: 600 };
const DEFAULTS = { checkIntervalMinutes: 60, notificationsEnabled: true, dropPercent: 0, notifyLow: true, notifyStock: true, globalPause: false, useFetch: true, alertLowDays: 0, alertBelowHighPct: 0, digestMode: false, showRegularPrice: true, theme: "auto" };
const STORE_URL = "https://chromewebstore.google.com/detail/dodppojnnlcmbjeenenmpalmiikkmfkh";
const GROUP_CAP_THRESHOLD = 10, GROUP_DEFAULT_SELECTED = 8; // groups bigger than 10 open with the first 8 lines selected
const PARALLAX = 28; // % the covered screen slides while a new one pushes in
const COLORS = Array.from({ length: 10 }, (_, i) => `var(--chart-${i + 1})`);

/* ==================================================================== state */
const state = {
  lang: "ru", theme: "auto", tab: "products", loaded: false,
  products: [], insights: null, folders: [], health: {}, settings: { ...DEFAULTS },
  q: "", seg: "all", sort: "recent", store: "all", status: "any", refreshingAll: false,
  share: { firstRunAt: 0, dismissed: false, hiddenUntil: 0 },
};
const t = () => STR[state.lang];
const send = (type, payload = {}) => chrome.runtime.sendMessage({ type, ...payload }).then((res) => {
  if (res && typeof res === "object" && typeof res.error === "string") throw new Error(res.error);
  return res;
});
const debounce = (fn, ms) => { let id = 0; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function applyTheme(theme) {
  state.theme = ["light", "dark"].includes(theme) ? theme : "auto";
  const el = document.documentElement;
  if (state.theme === "auto") delete el.dataset.theme; else el.dataset.theme = state.theme;
  try { localStorage.setItem("pt-theme", state.theme); } catch { /* storage may be unavailable */ }
}
try { applyTheme(localStorage.getItem("pt-theme") ?? "auto"); } catch { /* first paint without a saved theme */ }

/* ============================================================ product facts */
const insightOf = (p) => state.insights?.byId?.[p.id];
const isUnavailable = (p) => p.status === "unavailable"; // a missing status means active (data from older versions)
const isErrored = (p) => p.trackingStatus === "error" && !isUnavailable(p);
const isPaused = (p) => p.trackingStatus === "paused";
const isTargetReached = (p) => p.targetPrice !== undefined && p.currentPrice <= p.targetPrice && !isUnavailable(p);
const storeOf = (p) => (p.store === "wb" ? "wb" : p.store === "ym" ? "ym" : "ozon");
const storeName = (p) => ({ ozon: t().storeOzon, wb: t().storeWb, ym: t().storeYm })[storeOf(p)];
const kindOf = (p) => (p.historyPriceKind === "ozon_card" ? "ozon_card" : "unknown");
const lastSeenAt = (p) => p.lastSuccessfulCheckAt ?? p.updatedAt ?? Date.now();
const imageOf = (p) => (typeof p.imageUrl === "string" && p.imageUrl.startsWith("https://") ? p.imageUrl : null);

/** "Lowest in 60 days": true only when the history covers 60 days and today's price is the lowest of them and was higher before. */
function isLow60(p, hist) {
  if (isUnavailable(p) || !hist?.length) return false;
  const kind = kindOf(p), mine = hist.filter((x) => (x.priceKind ?? "unknown") === kind);
  if (!mine.length || Math.min(...mine.map((x) => x.timestamp)) > Date.now() - 60 * DAY) return false;
  const win = mine.filter((x) => x.timestamp >= Date.now() - 60 * DAY).map((x) => x.price).concat(p.currentPrice);
  return p.currentPrice <= Math.min(...win) && Math.max(...win) > p.currentPrice;
}

/** Approximate time until the next automatic re-check of a failed product (the check runs on the alarm schedule). */
function retryText(p) {
  const interval = Math.max(30, Number(state.settings.checkIntervalMinutes) || 60);
  const waitMin = (p.errorStreak ?? 0) >= 5 ? Math.max(interval, 360) : interval;
  const left = Math.max(1, Math.ceil(((p.lastCheckedAt ?? Date.now()) + waitMin * 60000 - Date.now()) / 60000));
  return left >= 60 ? t().unitHour(Math.round(left / 60)) : t().unitMin(left);
}

/* ============================================================== data access */
async function loadProducts() {
  const [products, insights, folders, health] = await Promise.all([
    send("GET_PRODUCTS").catch(() => []), send("GET_INSIGHTS").catch(() => null), send("GET_FOLDERS").catch(() => []),
    chrome.storage.local.get("health").then((r) => r.health ?? {}).catch(() => ({})),
  ]);
  Object.assign(state, { products: products ?? [], insights, folders: folders ?? [], health, loaded: true });
}
async function reload() { await loadProducts(); renderRoot(); for (const s of [...stack]) if (s.refresh) s.render(); }
async function saveSettings(patch) { Object.assign(state.settings, patch); await chrome.storage.sync.set(patch); }

/* ================================================================= the shell */
const app = h("div", { class: "app" });
const stage = h("div", { class: "stage" });
const layer = h("div", { class: "layer" });
const tabbar = h("nav", { class: "tabbar", role: "tablist", "aria-label": "Разделы" });
const stack = []; // pushed screens (logical stack; elements may still be animating out)

function makeScreen(kind) {
  const el = h("section", { class: `screen ${kind}` });
  const scroll = h("div", { class: "scroll" });
  const content = h("div", { class: "content" });
  scroll.append(content);
  const dim = h("div", { class: "dim" });
  el.append(scroll, dim);
  elastic(scroll, content);
  return { el, scroll, content, dim, kind };
}
const rootScreen = makeScreen("root");
pressFeedback(app);

function place(s, p) {
  s.el.style.transform = p === 0 ? "" : `translate3d(${(p * 100).toFixed(3)}%, 0, 0)`;
  const pb = clamp(p, 0, 1), below = s.below;
  below.el.style.transform = pb >= 1 ? "" : `translate3d(${(-(1 - pb) * PARALLAX).toFixed(3)}%, 0, 0)`;
  below.dim.style.opacity = String(1 - pb);
  if (s.first) tabbar.style.transform = pb >= 1 ? "" : `translate3d(0, ${((1 - pb) * 120).toFixed(2)}%, 0)`;
}
function release(s) { s.el.remove(); s.below.el.style.transform = ""; s.below.dim.style.opacity = "0"; if (s.first && !stack.length) tabbar.style.transform = ""; }

/** Push a screen: it slides in along the path it leaves on, and an interrupted slide continues from where it is. */
function push(spec) {
  const s = Object.assign(makeScreen(spec.kind), spec);
  s.below = stack.at(-1) ?? rootScreen; s.first = stack.length === 0;
  s.navbar = h("nav", { class: "navbar" },
    h("button", { class: "back", type: "button", "aria-label": t().ariaBack, onclick: () => pop() }, icon("back"), h("span", { class: "back-text" }, spec.backLabel ?? t().back)));
  s.el.prepend(s.navbar);
  s.render = () => { const top = s.scroll.scrollTop; s.content.replaceChildren(...s.build(s).filter(Boolean)); s.scroll.scrollTop = top; };
  s.render();
  stage.append(s.el); stack.push(s);
  s.sp = new Spring(1, { onUpdate: (p) => place(s, p) });
  if (reduced()) { s.el.classList.add("fade-in"); s.sp.set(0); place(s, 0); } else { s.sp.set(1); requestAnimationFrame(() => s.sp.to(0)); }
  // swipe right to go back: 1:1 with the pointer from where the screen is now (so a grab mid-slide does not jump), rubber band on the other side
  let base = 0;
  drag(s.el, {
    axis: "x",
    canStart: (e) => s === stack.at(-1) && !e.target.closest(".chart-host, input, textarea, select, .sheet, .popover, [data-nodrag]"),
    onStart: () => { base = s.sp.x; s.sp.cancel(); },
    onMove: (d) => { const w = s.el.offsetWidth || 1, pos = base + d / w; s.sp.set(pos >= 0 ? pos : -rubber(-pos * w, 48) / w); place(s, s.sp.x); },
    onEnd: ({ d, v }) => {
      const w = s.el.offsetWidth || 1, pos = (base + d / w) * w, commit = project(pos, v) > w * 0.5 || (v > 500 && d > 24);
      if (commit) { stack.splice(stack.indexOf(s), 1); s.sp.onRest = () => release(s); }
      s.sp.to(commit ? 1 : 0, { velocity: v / w, damping: Math.abs(v) > 600 ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--spring-flick-damping")) || 0.78 : undefined });
    },
  });
  return s;
}
function pop() {
  const s = stack.pop();
  if (!s) return;
  s.sp.onRest = () => release(s);
  if (reduced()) { release(s); return; }
  s.sp.to(1);
}
function popToRoot() { while (stack.length) release(stack.pop()); tabbar.style.transform = ""; }

/* ============================================================ common pieces */
function thumbOf(p, { error = false } = {}) {
  if (error) return h("span", { class: "thumb warn", "aria-hidden": "true" }, icon("alert"));
  const url = imageOf(p);
  return h("span", { class: "thumb", "aria-hidden": "true" }, url ? h("img", { src: url, alt: "", loading: "lazy", referrerPolicy: "no-referrer" }) : h("span", { class: "thumb-letter" }, (p.title?.[0] ?? "?").toUpperCase()));
}

function productRow(p) {
  const gone = isUnavailable(p), err = isErrored(p), ins = insightOf(p);
  const caption = gone ? t().capGone(dateShort(p.unavailableSince ?? lastSeenAt(p)))
    : err ? `${t().capError} · ${t().retryIn(retryText(p))}`
    : `${storeName(p)} · ${isPaused(p) ? t().capPaused : isTargetReached(p) ? t().capTarget : ins?.low60 ? t().capLow60 : t().capTracked}`;
  const chg = !gone && !err && ins && Math.abs(ins.chg30 ?? 0) >= 0.001 ? ins.chg30 : null;
  return h("button", { class: `row product${gone ? " gone" : ""}${err ? " err" : ""}`, type: "button", dataset: { id: p.id }, onclick: () => openDetail(p.id) },
    thumbOf(p, { error: err }),
    h("span", { class: "row-main" }, h("span", { class: "row-title" }, p.title), h("span", { class: "row-cap" }, caption)),
    h("span", { class: "row-end" },
      h("span", { class: `row-price num${gone ? " stale" : ""}` }, money(p.currentPrice)),
      chg !== null ? h("span", { class: `chg num ${chg < 0 ? "drop" : "rise"}` }, pct(chg)) : null));
}

function renderProductList(host, list, { empty } = {}) {
  host.replaceChildren();
  if (!state.loaded) { host.append(skeletonRows()); return; }
  if (!list.length) { host.append(empty ?? emptyState(t().emptyNothing, t().emptyReset, resetFilters)); return; }
  host.append(group(...list.map(productRow)));
}

/* ==================================================== filtering and sorting */
const SEG = { all: () => true, dropped: (p) => (insightOf(p)?.drop30 ?? 0) > 0, gone: isUnavailable, errors: isErrored };
const SORTS = {
  recent: (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  drop: (a, b) => (insightOf(a)?.chg30 ?? 0) - (insightOf(b)?.chg30 ?? 0),
  low: (a, b) => a.currentPrice - b.currentPrice,
  target: (a, b) => Number(isTargetReached(b)) - Number(isTargetReached(a)),
  name: (a, b) => a.title.localeCompare(b.title, state.lang),
};
const inScope = (p, scope) => (scope === "all" ? true : scope === "none" ? !p.folderId : p.folderId === scope);
function visibleProducts(scope = "all") {
  const q = state.q.trim().toLowerCase();
  return state.products.filter((p) => inScope(p, scope) && SEG[state.seg](p)
    && (!q || p.title.toLowerCase().includes(q) || String(p.id).includes(q))
    && (state.store === "all" || storeOf(p) === state.store)
    && (state.status === "any" || (state.status === "paused" ? isPaused(p) : isTargetReached(p)))).sort(SORTS[state.sort]);
}
function resetFilters() { Object.assign(state, { q: "", seg: "all", store: "all", status: "any", sort: "recent" }); renderRoot({ keepScroll: false }); }
const counts = (scope = "all") => Object.fromEntries(Object.keys(SEG).map((k) => [k, state.products.filter((p) => inScope(p, scope) && SEG[k](p)).length]));

/* ================================================================ root tabs */
const TABS = [["products", "tag", () => t().tabProducts], ["folders", "folder", () => t().tabFolders], ["alerts", "bell", () => t().tabAlerts]];
function renderTabbar() {
  tabbar.replaceChildren(...TABS.map(([id, ic, label]) => h("button", { class: "tab", type: "button", role: "tab", "aria-selected": String(state.tab === id), tabIndex: state.tab === id ? 0 : -1, onclick: () => switchTab(id) }, icon(ic), h("span", {}, label()))));
}
const fade = new Spring(1, { response: 0.25, onUpdate: (v) => { rootScreen.content.style.opacity = String(clamp(v, 0, 1)); } });
function switchTab(id) {
  if (state.tab === id) { rootScreen.scroll.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); return; }
  state.tab = id; renderTabbar(); renderRoot({ keepScroll: false }); fade.set(0.001); fade.to(1);
}
function renderRoot({ keepScroll = true } = {}) {
  const top = rootScreen.scroll.scrollTop;
  const nodes = state.tab === "folders" ? foldersTab() : state.tab === "alerts" ? alertsTab() : productsTab();
  rootScreen.content.replaceChildren(...nodes.filter(Boolean));
  rootScreen.scroll.scrollTop = keepScroll ? top : 0;
}

/* -------------------------------------------------------------- products tab */
let productsUi = null;
function productsTab() {
  const last = Math.max(0, ...state.products.map((p) => p.lastCheckedAt ?? 0));
  const status = state.refreshingAll ? t().checkingAll : last ? t().updated(minutesAgo(last)) : "";
  const sc = counts();
  const seg = segmented({
    label: t().appTitle, value: state.seg, onChange: (id) => { state.seg = id; renderList(); },
    items: [["all", t().segAll], ["dropped", t().segDropped], ["gone", t().segGone], ["errors", t().segErrors]].map(([id, text]) => ({ id, text, count: sc[id] })),
  });
  const listHost = h("div", { class: "list-host" });
  productsUi = { listHost, seg };
  const search = h("input", { class: "search-input", type: "search", placeholder: t().searchPh, value: state.q, "aria-label": t().searchPh, autocomplete: "off" });
  const clear = roundButton("close", t().clearSearch, () => { state.q = ""; search.value = ""; clear.hidden = true; renderList(); search.focus(); }, "small");
  clear.hidden = !state.q;
  search.addEventListener("input", debounce(() => { state.q = search.value; clear.hidden = !state.q; renderList(); }, 120));
  const nodes = [
    h("div", { class: "topbar" }, h("span", { class: "status-line", role: "status" }, status), roundButton("more", t().ariaMore, (e) => openMore(e.currentTarget))),
    h("h1", { class: "title" }, t().appTitle),
    ...banners(), savingsCard(),
    h("div", { class: "searchrow" }, h("label", { class: "field" }, icon("search", "icon field-icon"), search, clear), roundButton("filter", t().filtersBtn, openFilterSheet)),
    seg.el, listHost, shareLine(),
  ];
  renderList();
  return nodes;
}
function renderList() {
  if (!productsUi) return;
  const list = visibleProducts("all");
  let empty = null;
  if (state.loaded && !state.products.length) empty = emptyState(t().emptyProducts, t().emptyImport, pickImportFile);
  else if (state.loaded && !list.length && !state.q && state.store === "all" && state.status === "any") {
    const msg = { dropped: t().emptyDropped, gone: t().emptyGone, errors: t().emptyErrors }[state.seg];
    if (msg) empty = emptyState(msg, t().showAllProducts, () => { state.seg = "all"; renderRoot(); });
  }
  renderProductList(productsUi.listHost, list, { empty });
  productsUi.seg.setCounts(counts()); productsUi.seg.setValue(state.seg);
}

function banners() {
  const out = [];
  if (state.settings.globalPause) out.push(h("div", { class: "notice" }, t().globalPaused));
  const names = { ozon: t().storeOzon, wb: t().storeWb, ym: t().storeYm };
  for (const [k, name] of Object.entries(names)) {
    if ((state.health[k]?.fails ?? 0) >= 3 && state.products.some((p) => storeOf(p) === k)) out.push(h("div", { class: "notice warn", role: "status" }, t().health(name, state.health[k].fails, state.health[k].lastError)));
  }
  return out;
}

function savingsCard() {
  const sm = state.insights?.summary, total = sm?.drop30Total ?? 0;
  if (!(total > 0)) return null;
  const big = h("div", { class: "saved-total num" });
  countUp(big, total, money, "savings");
  return h("section", { class: "card saved" }, h("div", { class: "caption" }, t().savedTitle), big, h("span", { class: "pill drop" }, t().cheaper(sm.drop30Count ?? 0)));
}

function openMore(trigger) {
  openPopover(layer, trigger, (pop, close) => {
    const item = (label, run) => h("button", { class: "menu-item", type: "button", role: "menuitem", onclick: () => { close(); run(); } }, label);
    pop.append(
      item(t().refreshAll, refreshAll),
      ...(!IN_TAB ? [item(t().openedInTab, () => chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?tab=1") }))] : []),
      item(t().settingsTitle, openSettings));
  });
}

function openFilterSheet() {
  openSheet(layer, { title: t().filtersBtn, build: (body) => {
    const radios = (title, options, key) => {
      const rows = options.map(([id, text]) => {
        const row = h("button", { class: "row radio", type: "button", role: "radio", "aria-checked": String(state[key] === id), dataset: { id },
          onclick: () => { state[key] = id; rows.forEach((r) => r.setAttribute("aria-checked", String(r.dataset.id === id))); renderList(); } },
          h("span", { class: "row-main" }, h("span", { class: "row-title" }, text)), icon("check", "icon check-mark"));
        return row;
      });
      return [sectionTitle(title), group(...rows)];
    };
    body.append(
      ...radios(t().sortTitle, [["recent", t().sort.recent], ["drop", t().sort.drop], ["low", t().sort.low], ["target", t().sort.target], ["name", t().sort.name]], "sort"),
      ...radios(t().storeTitle, [["all", t().segAll], ["ozon", t().storeOzon], ["wb", t().storeWb], ["ym", t().storeYm]], "store"),
      ...radios(t().statusTitle, [["any", t().stAll], ["paused", t().stPaused], ["target", t().stTarget]], "status"));
  } });
}

/* -------------------------------------------------------------- folders tab */
function foldersTab() {
  const nones = state.products.filter((p) => !p.folderId).length;
  const folderRow = (name, n, onclick, ic = "folder") => h("button", { class: "row", type: "button", onclick },
    h("span", { class: "thumb tile", "aria-hidden": "true" }, icon(ic)), h("span", { class: "row-main" }, h("span", { class: "row-title" }, name), h("span", { class: "row-cap" }, t().countProducts(n))), icon("chevron", "icon chevron"));
  const rows = [folderRow(t().allProducts, state.products.length, () => switchTab("products"), "tag"),
    ...state.folders.map((f) => folderRow(f.name, state.products.filter((p) => p.folderId === f.id).length, () => openFolder(f.id))),
    folderRow(t().folderNone, nones, () => openFolder("none"))];
  return [
    h("div", { class: "topbar" }, h("span", { class: "status-line" }), roundButton("more", t().ariaMore, (e) => openMore(e.currentTarget))),
    h("h1", { class: "title" }, t().foldersTitle),
    h("div", { class: "pills-row" }, h("button", { class: "pill tint", type: "button", onclick: () => openFolderSheet(null) }, t().newFolderBtn)),
    group(...rows),
    state.folders.length ? null : h("p", { class: "hint-text" }, t().noFolders),
  ];
}

function folderError(e) {
  const m = String(e?.message ?? e);
  if (m.includes("name is required")) return t().errNameRequired;
  if (m.includes("too long")) return t().errNameLong;
  if (m.includes("already exists")) return t().errNameDup;
  if (m.includes("Too many")) return t().errTooMany;
  return m;
}
/** Sheet with a single text field: creates a folder (id === null) or renames one. */
function openFolderSheet(id) {
  const cur = state.folders.find((f) => f.id === id);
  openSheet(layer, { title: t().folderSheetTitle, build: (body, close) => {
    const input = h("input", { class: "text-input", type: "text", maxLength: 40, value: cur?.name ?? "", placeholder: t().folderName, "aria-label": t().folderName });
    const msg = h("p", { class: "form-msg", role: "alert" });
    const save = async () => {
      try {
        if (id) await send("RENAME_FOLDER", { id, name: input.value }); else await send("CREATE_FOLDER", { name: input.value });
        close(); await reload();
      } catch (e) { msg.textContent = folderError(e); input.focus(); }
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
    body.append(h("div", { class: "form" }, input, msg, h("button", { class: "pill primary", type: "button", onclick: save }, t().save)));
  } });
}

function openFolder(scope) {
  push({
    kind: "folder", refresh: true, backLabel: t().tabFolders,
    build: () => {
      const f = state.folders.find((x) => x.id === scope);
      if (scope !== "none" && !f) { setTimeout(pop); return []; }
      const list = state.products.filter((p) => inScope(p, scope)).sort(SORTS.recent);
      const host = h("div", { class: "list-host" });
      renderProductList(host, list, { empty: emptyState(t().emptyFolder, t().showAllProducts, () => { popToRoot(); switchTab("products"); }) });
      return [
        h("h1", { class: "title" }, f?.name ?? t().folderNone),
        h("p", { class: "caption" }, t().countProducts(list.length)),
        f ? h("div", { class: "pills-row" },
          h("button", { class: "pill primary", type: "button", onclick: () => openGroup(f.id, f.name) }, t().groupBtn),
          h("button", { class: "pill tint", type: "button", onclick: () => openFolderSheet(f.id) }, t().renameBtn),
          h("button", { class: "pill tint danger", type: "button", onclick: () => deleteFolder(f) }, t().deleteFolderBtn)) : null,
        host,
      ];
    },
  });
}

/** Delete a folder immediately; "Отменить" recreates it with the same id and puts its products back. */
async function deleteFolder(f) {
  const members = state.products.filter((p) => p.folderId === f.id).map((p) => p.id);
  await send("DELETE_FOLDER", { id: f.id });
  await reload(); pop();
  toast(layer, t().folderDeletedToast(f.name), { label: t().undo, run: async () => {
    await send("IMPORT_DATA", { data: { products: [], history: [], folders: [{ id: f.id, name: f.name, createdAt: f.createdAt }] } });
    for (const pid of members) await send("SET_PRODUCT_FOLDER", { id: pid, folderId: f.id }).catch(() => {});
    await reload(); toast(layer, t().folderRestoredToast);
  } });
}

/* ------------------------------------------------------------- alerts tab */
function alertsTab() {
  const s = state.settings;
  const withTargets = state.products.filter((p) => p.targetPrice !== undefined).sort((a, b) => (a.currentPrice - a.targetPrice) - (b.currentPrice - b.targetPrice));
  const targetRow = (p) => h("button", { class: "row product", type: "button", onclick: () => openDetail(p.id) }, thumbOf(p),
    h("span", { class: "row-main" }, h("span", { class: "row-title" }, p.title), h("span", { class: "row-cap" }, isTargetReached(p) ? t().targetReachedCap : t().targetLeftCap(money(Math.max(0, p.currentPrice - p.targetPrice))))),
    h("span", { class: "row-end" }, h("span", { class: "row-price num" }, money(p.targetPrice))));
  return [
    h("div", { class: "topbar" }, h("span", { class: "status-line" }), roundButton("more", t().ariaMore, (e) => openMore(e.currentTarget))),
    h("h1", { class: "title" }, t().alertsTitle),
    sectionTitle(t().secNotify),
    group(
      switchRow(t().notifications, s.notificationsEnabled, (v) => saveSettings({ notificationsEnabled: v })),
      numberRow(t().dropPercent, s.dropPercent, { max: 95, suffix: "%", onChange: (v) => saveSettings({ dropPercent: v }) }),
      switchRow(t().notifyLow, s.notifyLow, (v) => saveSettings({ notifyLow: v })),
      switchRow(t().notifyStock, s.notifyStock, (v) => saveSettings({ notifyStock: v })),
      numberRow(t().alertLowDays, s.alertLowDays, { max: 365, onChange: (v) => saveSettings({ alertLowDays: v }) }),
      numberRow(t().alertBelowHighPct, s.alertBelowHighPct, { max: 95, suffix: "%", onChange: (v) => saveSettings({ alertBelowHighPct: v }) }),
      switchRow(t().digestMode, s.digestMode, (v) => saveSettings({ digestMode: v }), t().digestHint)),
    sectionTitle(t().targetsTitle),
    withTargets.length ? group(...withTargets.map(targetRow)) : emptyState(t().noTargets, t().openProducts, () => switchTab("products")),
  ];
}

/* ======================================================== product detail */
function openDetail(id) {
  push({ kind: "detail", id, refresh: true, range: 90, hist: null, backLabel: state.tab === "alerts" ? t().tabAlerts : t().tabProducts, build: (s) => detailContent(s) });
}

function detailContent(s) {
  const p = state.products.find((x) => x.id === s.id);
  if (!p) { setTimeout(pop); return []; }
  if (!s.histPromise) s.histPromise = send("GET_HISTORY", { productId: s.id, since: 0 }).then((rows) => { s.hist = rows ?? []; s.render(); }).catch(() => { s.hist = []; s.render(); });
  const gone = isUnavailable(p), err = isErrored(p), hist = s.hist ?? [], kind = kindOf(p);
  const mine = hist.filter((x) => (x.priceKind ?? "unknown") === kind);
  const low60 = isLow60(p, hist);
  const max90 = mine.length ? Math.max(...mine.filter((x) => x.timestamp >= Date.now() - 90 * DAY).map((x) => x.price).concat(p.currentPrice)) : null;
  const was = !gone && p.previousPrice && p.previousPrice > p.currentPrice ? p.previousPrice : null;
  const rowOf = (label, value, cap) => h("div", { class: "row" }, h("span", { class: "row-main" }, h("span", { class: "row-title" }, label), cap ? h("span", { class: "row-cap" }, cap) : null), value === "" ? null : h("span", { class: "row-end" }, h("span", { class: "row-value num" }, value)));
  const price = h("div", { class: `hero-price num${gone ? " stale" : ""}` });
  if (gone) price.textContent = money(p.currentPrice); else countUp(price, p.currentPrice, money, `hero:${p.id}`);

  const heroRows = [was ? rowOf(t().youSave, money(was - p.currentPrice)) : null, max90 !== null ? rowOf(t().max90, money(max90)) : null].filter(Boolean);
  const hero = h("section", { class: "card hero" },
    gone ? h("span", { class: "pill gone" }, t().capGone(dateShort(p.unavailableSince ?? lastSeenAt(p)))) : low60 ? h("span", { class: "pill drop" }, t().heroLow) : null,
    price,
    was ? h("div", { class: "was num" }, h("s", {}, money(was))) : null,
    gone ? h("div", { class: "caption" }, `${t().lastPrice} · ${t().lastSeen(dateShort(lastSeenAt(p)))}`) : null,
    err && p.lastError ? h("div", { class: "caption warn-text" }, `${t().capError}: ${p.lastError}`) : null,
    heroRows.length ? group(...heroRows) : null);

  // chart card
  const host = h("div", { class: "chart-host" });
  const range = segmented({ label: t().chartFor, value: String(s.range), onChange: (id) => { s.range = Number(id); drawDetailChart(s, p, host, hist, mine); },
    items: [["30", t().range30], ["90", t().range90], ["0", t().rangeAll]].map(([id, text]) => ({ id, text })) });
  const chartCard = h("section", { class: "card chartcard" },
    h("div", { class: "chart-head" }, range.el, fullscreenButton(() => chartCard, `detail=${encodeURIComponent(p.id)}`)),
    s.hist ? host : h("div", { class: "chart-skeleton sk", "aria-hidden": "true" }),
    p.createdAt ? h("div", { class: "caption since" }, t().since(dateLong(p.createdAt), Math.max(1, Math.ceil((Date.now() - p.createdAt) / DAY)))) : null);
  if (s.hist) queueMicrotask(() => drawDetailChart(s, p, host, hist, mine));

  // facts
  const ins = insightOf(p);
  const folderSelect = h("select", { class: "select", "aria-label": t().rowFolder, onchange: async (e) => { await send("SET_PRODUCT_FOLDER", { id: p.id, folderId: e.target.value || null }).catch(() => {}); await reload(); } },
    h("option", { value: "", selected: !p.folderId }, t().folderNone), state.folders.map((f) => h("option", { value: f.id, selected: f.id === p.folderId }, f.name)));
  const facts = [
    rowOf(t().rowStore, storeName(p)),
    h("label", { class: "row row-field" }, h("span", { class: "row-main" }, h("span", { class: "row-title" }, t().rowFolder)), h("span", { class: "row-end" }, folderSelect)),
    p.historyPriceKind === "ozon_card" && p.regularPrice ? rowOf(t().withoutCard, money(p.regularPrice)) : null,
    p.store === "ym" && p.regularPrice ? rowOf(t().oldPrice, money(p.regularPrice), p.discountPercent ? `−${p.discountPercent}%` : undefined) : null,
    p.walletPrice ? rowOf(t().wallet, money(p.walletPrice)) : null,
    p.priceBadge === "pay" ? rowOf(t().payLabel, "") : null,
    p.promoCode ? promoRow(p) : null,
    p.pendingPrice ? rowOf(t().ins.pending(money(p.pendingPrice.value)), "") : null,
    rowOf(t().rowLowest, money(p.lowestPrice)), rowOf(t().rowHighest, money(p.highestPrice)),
    rowOf(t().rowChecked, p.lastCheckedAt ? dateTime(p.lastCheckedAt) : t().never),
  ].filter(Boolean);
  const analysis = !gone && ins ? [
    ins.buy && ins.buy !== "none" ? rowOf(t().analysis, { lowest: t().ins.lowest, near: t().ins.near, above: t().ins.above, fair: t().ins.fair, none: "" }[ins.buy]) : null,
    ins.discount === "real" ? rowOf(t().ins.real(ins.discountPct), "") : ins.discount === "fake" ? rowOf(t().ins.fake, "", t().ins.tipFake) : null,
  ].filter(Boolean) : [];

  // actions
  const notify = h("button", { class: "pill tint", type: "button", disabled: gone, onclick: () => openTargetSheet(p) }, p.targetPrice !== undefined ? t().notifyBelow(money(p.targetPrice)) : t().notifySet);
  const open = h("a", { class: "pill primary", href: p.canonicalUrl ?? p.url, target: "_blank", rel: "noopener noreferrer" }, t().openOn(storeName(p)));
  const checkBtn = h("button", { class: "row action", type: "button", onclick: async () => {
    checkBtn.disabled = true; checkBtn.firstChild.textContent = t().checking;
    try { await send("REFRESH_PRODUCT", { id: p.id }); s.histPromise = null; toast(layer, t().checkedToast); } catch { toast(layer, t().checkFailedToast); }
    await reload();
  } }, h("span", { class: "row-title" }, t().checkNow));
  const actions = group(checkBtn,
    h("button", { class: "row action", type: "button", onclick: async () => { await send("PAUSE_PRODUCT", { id: p.id, paused: !isPaused(p) }).catch(() => {}); await reload(); } }, h("span", { class: "row-title" }, isPaused(p) ? t().resume : t().pause)),
    h("button", { class: "row action danger", type: "button", onclick: () => deleteProduct(p) }, h("span", { class: "row-title" }, t().deleteProduct)));

  return [
    h("h1", { class: "title2" }, p.title),
    h("p", { class: "caption" }, `${storeName(p)} · ${gone ? t().capGone(dateShort(p.unavailableSince ?? lastSeenAt(p))) : isPaused(p) ? t().capPaused : err ? t().capError : t().capTracked}`),
    hero, chartCard,
    group(...facts), analysis.length ? group(...analysis) : null,
    h("div", { class: "cta" }, open, notify),
    actions,
  ];
}

function promoRow(p) {
  const est = p.promoPercent ? money(Math.round(p.currentPrice * (1 - p.promoPercent / 100))) : "";
  const label = h("span", { class: "row-title" }, t().promo(p.promoCode, p.promoPercent));
  const btn = h("button", { class: "row action", type: "button", title: t().promoTip(p.promoCode, est), onclick: () => {
    navigator.clipboard?.writeText(p.promoCode).then(() => { label.textContent = t().copied; setTimeout(() => { label.textContent = t().promo(p.promoCode, p.promoPercent); }, 1200); }).catch(() => {});
  } }, label);
  return btn;
}

function detailSeries(p, hist, range) {
  const now = Date.now(), start = range ? now - range * DAY : 0, gone = isUnavailable(p), card = p.historyPriceKind === "ozon_card";
  const mk = (kind, current, color, name) => {
    const all = hist.filter((x) => (x.priceKind ?? "unknown") === kind).sort((a, b) => a.timestamp - b.timestamp).map((x) => ({ t: x.timestamp, v: x.price, price: x.price }));
    // reach "now" at the current price, except for an unavailable product: its line ends at the last real price
    if (!gone && current && (!all.length || now - all.at(-1).t > 6e4)) all.push({ t: now, v: current, price: current });
    const before = start ? all.filter((x) => x.t < start).at(-1) : null;
    let pts = all.filter((x) => x.t >= start);
    if (before) pts = [{ t: start, v: before.v, price: before.price }, ...pts];
    return { id: kind, name, color, gone, pts };
  };
  const series = [mk(kindOf(p), p.currentPrice, COLORS[0], card ? t().card : t().regular)];
  if (card && state.settings.showRegularPrice) { const reg = mk("unknown", p.regularPrice, COLORS[1], t().withoutCard); if (reg.pts.length) series.push(reg); }
  return series;
}

function drawDetailChart(s, p, host, hist, mine) {
  const series = detailSeries(p, hist, s.range);
  if (!series[0].pts.length) { host.__chart?.destroy(); host.replaceChildren(h("p", { class: "hint-text" }, t().noHistory)); return; }
  const lowAll = mine.length ? Math.min(...mine.map((x) => x.price)) : null, hiAll = mine.length ? Math.max(...mine.map((x) => x.price)) : null;
  const fs = !!document.fullscreenElement && document.fullscreenElement.contains(host);
  renderChart(host, {
    series, yFormat: (v) => money(v), xFormat: dateShort, marker: true, animateKey: `detail:${p.id}`, ariaLabel: t().chartFor, fill: fs,
    ref: lowAll !== null && hiAll !== null && lowAll < hiAll ? { v: lowAll, label: t().lowLine(money(lowAll)) } : undefined,
    tip: (pt, ser) => [money(pt.price), `${dateLong(pt.t)}${series.length > 1 ? ` · ${ser.name}` : ""}`],
  });
  activeCharts.set(host, () => drawDetailChart(s, p, host, hist, mine));
}

function openTargetSheet(p) {
  openSheet(layer, { title: t().targetTitle, build: (body, close) => {
    const input = h("input", { class: "text-input num", type: "number", min: "2", step: "1", value: p.targetPrice ?? "", placeholder: t().targetField, "aria-label": t().targetField });
    const msg = h("p", { class: "form-msg", role: "alert" });
    const apply = async (value) => { try { await send("SET_TARGET", { id: p.id, targetPrice: value }); close(); await reload(); } catch (e) { msg.textContent = String(e.message ?? e); } };
    const save = () => { const v = Number(input.value); if (!(v > 1 && v < 1e8)) { msg.textContent = t().invalidTarget; input.focus(); return; } apply(Math.round(v)); };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
    body.append(h("div", { class: "form" }, h("p", { class: "hint-text" }, t().targetHint), input, msg,
      h("button", { class: "pill primary", type: "button", onclick: save }, t().save),
      p.targetPrice !== undefined ? h("button", { class: "pill tint", type: "button", onclick: () => apply(undefined) }, t().targetClear) : null));
  } });
}

/** Delete immediately; "Отменить" really restores the product with its whole history (and folder, if it still exists). */
async function deleteProduct(p) {
  const history = await send("GET_HISTORY", { productId: p.id, since: 0 }).catch(() => []);
  const copy = JSON.parse(JSON.stringify(p));
  await send("UNTRACK_PRODUCT", { id: p.id });
  await reload(); pop();
  toast(layer, t().deletedToast(p.title), { label: t().undo, run: async () => {
    await send("IMPORT_DATA", { data: { products: [copy], history, folders: [] } });
    await reload(); toast(layer, t().restoredToast);
  } });
}

/* ================================================================ group chart */
const groupPrefs = { range: 90, mode: "abs", hidden: new Set(), filter: "", onlySelected: false, capped: false };

async function initialHidden(folderId, entries) {
  const ids = entries.map((e) => e.p.id);
  let saved = null;
  try { saved = (await chrome.storage.local.get("groupSel")).groupSel?.[folderId] ?? null; } catch { /* storage unavailable: use the default */ }
  if (saved && Array.isArray(saved.sel)) {
    const sel = new Set(saved.sel), known = new Set(saved.all ?? []);
    return { hidden: new Set(ids.filter((id) => (known.has(id) ? !sel.has(id) : ids.length > GROUP_CAP_THRESHOLD))), capped: false };
  }
  return ids.length > GROUP_CAP_THRESHOLD ? { hidden: new Set(ids.slice(GROUP_DEFAULT_SELECTED)), capped: true } : { hidden: new Set(), capped: false };
}
const saveGroupSelection = debounce(async (folderId, entries) => {
  try {
    const all = (await chrome.storage.local.get("groupSel")).groupSel ?? {};
    all[folderId] = { sel: entries.filter((e) => !groupPrefs.hidden.has(e.p.id)).map((e) => e.p.id), all: entries.map((e) => e.p.id) };
    await chrome.storage.local.set({ groupSel: all });
  } catch { /* best effort */ }
}, 300);

async function loadGroupData(folderId) {
  const items = state.products.filter((p) => p.folderId === folderId);
  const histories = await Promise.all(items.map((p) => send("GET_HISTORY", { productId: p.id, since: 0 }).catch(() => [])));
  const entries = items.map((p, i) => ({ p, history: histories[i] ?? [], color: COLORS[i % COLORS.length], hay: `${p.title} ${p.id} ${p.ozonProductId ?? ""} ${String(p.id).replace(/^[a-z]+:/, "")}`.toLowerCase() }));
  const init = await initialHidden(folderId, entries);
  groupPrefs.hidden = init.hidden; groupPrefs.capped = init.capped;
  return entries;
}

function groupSeries(entries) {
  const now = Date.now(), start = groupPrefs.range ? now - groupPrefs.range * DAY : 0, out = [];
  for (const { p, history, color } of entries) {
    const card = p.historyPriceKind === "ozon_card", gone = isUnavailable(p);
    const lines = [{ kind: card ? "ozon_card" : "unknown", current: gone ? null : p.currentPrice, regular: false }];
    if (card && state.settings.showRegularPrice) lines.push({ kind: "unknown", current: gone ? null : p.regularPrice, regular: true });
    for (const ln of lines) {
      const own = history.filter((x) => (x.priceKind ?? "unknown") === ln.kind).sort((a, b) => a.timestamp - b.timestamp);
      if (ln.regular && !own.length) continue;
      const full = [...own];
      if (ln.current && (!full.length || now - full.at(-1).timestamp > 6e4)) full.push({ timestamp: now, price: ln.current });
      if (!full.length) continue;
      const base = full[0].price;
      let pts = full.filter((x) => x.timestamp >= start);
      const before = start ? full.filter((x) => x.timestamp < start).at(-1) : null;
      if (before) pts = [{ timestamp: start, price: before.price }, ...pts];
      if (!pts.length) continue;
      const val = (price) => (groupPrefs.mode === "pct" ? (price / base - 1) * 100 : price);
      out.push({ id: p.id + (ln.regular ? ":r" : ""), pid: p.id, name: p.title, color, dashed: ln.regular, gone, pts: pts.map((x) => ({ t: x.timestamp, v: val(x.price), price: x.price, base })) });
    }
  }
  return out;
}

function openGroup(folderId, name) {
  Object.assign(groupPrefs, { hidden: new Set(), filter: "", onlySelected: false, capped: false });
  const folder = state.folders.find((f) => f.id === folderId);
  push({ kind: "groupchart", folderId, refresh: false, backLabel: name ?? folder?.name ?? t().tabFolders, build: (s) => groupContent(s, folderId, folder?.name ?? name ?? "") });
}

function groupContent(s, folderId, name) {
  const page = h("div", { class: "group-page" });
  const caption = h("p", { class: "caption" });
  const body = h("div", { class: "group-body" }, skeletonRows(4));
  page.append(h("h1", { class: "title" }, name), caption, body);
  loadGroupData(folderId).then((entries) => { if (s.el.contains(page)) fillGroup(page, body, caption, folderId, entries); });
  return [page];
}

function fillGroup(page, body, caption, folderId, entries) {
  const prefs = groupPrefs;
  body.replaceChildren();
  if (!entries.length) { caption.textContent = t().countProducts(0); body.append(emptyState(t().groupEmpty, t().tabFolders, () => pop())); return; }
  const hasCard = entries.some((e) => e.p.historyPriceKind === "ozon_card");
  const isSel = (e) => !prefs.hidden.has(e.p.id);
  const needle = () => prefs.filter.trim().toLowerCase();
  const matches = (e) => !needle() || e.hay.includes(needle());

  // ---- controls: range, mode, fullscreen, regular price
  const rangeSeg = segmented({ label: t().chart, value: String(prefs.range), onChange: (id) => { prefs.range = Number(id); renderGroupChart(); },
    items: [["30", t().range30], ["90", t().range90], ["0", t().rangeAll]].map(([id, text]) => ({ id, text })) });
  const modeSeg = segmented({ label: t().modeAbs, value: prefs.mode, onChange: (id) => { prefs.mode = id; renderGroupChart(); renderList(); },
    items: [{ id: "abs", text: t().modeAbs }, { id: "pct", text: t().modeNorm }] });
  const fsBtn = fullscreenButton(() => page, `group=${encodeURIComponent(folderId)}`, true);
  const regular = hasCard ? switchRow(t().showRegular, state.settings.showRegularPrice, async (v) => { await saveSettings({ showRegularPrice: v }); renderGroupChart(); renderList(); }) : null;

  // ---- chart card
  const chartHost = h("div", { class: "chart-host" });
  const hint = h("p", { class: "caption" }, t().normHint);
  const capNote = h("p", { class: "caption cap-note" });
  const chartCard = h("section", { class: "card chartcard group-main" }, chartHost, hint, capNote);

  // ---- side card: search + actions + list
  const input = h("input", { class: "search-input gfilter", type: "search", placeholder: t().filterGroupPh, value: prefs.filter, "aria-label": t().filterPh, autocomplete: "off" });
  const clear = roundButton("close", t().filterClear, () => { prefs.filter = ""; input.value = ""; renderList(); input.focus(); }, "small");
  const found = h("p", { class: "caption found" });
  const pills = {
    sel: h("button", { class: "pill primary small", type: "button" }),
    des: h("button", { class: "pill tint small", type: "button" }),
    only: h("button", { class: "pill tint small", type: "button" }, t().onlyMatchingBtn),
    chosen: h("button", { class: "pill tint small", type: "button", "aria-pressed": String(prefs.onlySelected) }, t().onlySelectedBtn),
  };
  const rows = entries.map((e) => {
    const gone = isUnavailable(e.p);
    const cb = h("input", { type: "checkbox", checked: isSel(e), "aria-label": e.p.title, onchange: () => setSel([e], cb.checked) });
    const nameEl = h("span", { class: "row-title" });
    const cap = gone ? h("span", { class: "row-cap" }, t().capGone(dateShort(e.p.unavailableSince ?? lastSeenAt(e.p)))) : null;
    const price = h("span", { class: `row-price num${gone ? " stale" : ""}` });
    const row = h("label", { class: "row check" }, cb, h("i", { class: `key${gone ? " gone" : ""}`, style: `--c:${e.color}` }), h("span", { class: "row-main" }, nameEl, cap), h("span", { class: "row-end" }, price));
    return { e, cb, nameEl, price, row };
  });
  const list = group(...rows.map((r) => r.row));
  list.classList.add("check-list");
  const side = h("section", { class: "card side" }, h("div", { class: "searchrow" }, h("label", { class: "field" }, icon("search", "icon field-icon"), input, clear)), found,
    h("div", { class: "pills-row wrap" }, pills.sel, pills.des, pills.only, pills.chosen), list);

  const latest = (e) => { const ser = groupSeries([e]).find((x) => !x.dashed); const last = ser?.pts.at(-1); if (!last) return ""; return prefs.mode === "pct" ? pct(last.price / last.base - 1) : money(last.price); };
  function renderList() {
    const nMatch = entries.filter(matches).length, nSel = entries.filter(isSel).length;
    found.textContent = t().found(nMatch, entries.length);
    pills.sel.textContent = t().selectMatching(nMatch); pills.des.textContent = t().deselectMatching(nMatch);
    pills.sel.disabled = pills.des.disabled = pills.only.disabled = nMatch === 0;
    pills.chosen.setAttribute("aria-pressed", String(prefs.onlySelected));
    clear.hidden = !needle();
    caption.textContent = t().groupCaption(entries.length, nSel);
    for (const r of rows) {
      r.nameEl.replaceChildren(...highlight(r.e.p.title, prefs.filter));
      r.row.classList.toggle("dim", !matches(r.e));
      r.row.hidden = prefs.onlySelected && !isSel(r.e);
      r.cb.checked = isSel(r.e);
      r.price.textContent = latest(r.e);
    }
    capNote.hidden = !prefs.capped; capNote.textContent = t().capNote(GROUP_DEFAULT_SELECTED, entries.length);
    hint.hidden = prefs.mode !== "pct";
  }
  function renderGroupChart() {
    const sel = groupSeries(entries.filter(isSel));
    if (!sel.length) { chartHost.__chart?.destroy(); chartHost.replaceChildren(h("p", { class: "hint-text" }, t().groupAllHidden)); return; }
    const fs = !!document.fullscreenElement && document.fullscreenElement.contains(page), pctMode = prefs.mode === "pct";
    renderChart(chartHost, {
      series: sel, yFormat: pctMode ? (v) => pct(v / 100) : (v) => money(Math.round(v)), xFormat: dateShort, zero: pctMode, ariaLabel: t().groupChart, fill: fs,
      tip: (pt, ser) => [ser.name, `${dateLong(pt.t)} · ${money(pt.price)}${pctMode ? ` (${pct(pt.price / pt.base - 1)})` : ""}${ser.gone ? ` · ${t().goneTag}` : ""}`],
    });
  }
  function changed() { prefs.capped = false; renderGroupChart(); renderList(); saveGroupSelection(folderId, entries); }
  function setSel(items, on) { for (const e of items) { if (on) prefs.hidden.delete(e.p.id); else prefs.hidden.add(e.p.id); } changed(); }
  pills.sel.addEventListener("click", () => setSel(entries.filter(matches), true));
  pills.des.addEventListener("click", () => setSel(entries.filter(matches), false));
  pills.only.addEventListener("click", () => { prefs.hidden = new Set(entries.filter((e) => !matches(e)).map((e) => e.p.id)); changed(); });
  pills.chosen.addEventListener("click", () => { prefs.onlySelected = !prefs.onlySelected; renderList(); });
  input.addEventListener("input", debounce(() => { prefs.filter = input.value; renderList(); }, 150)); // only the list is touched, never the chart

  body.append(h("div", { class: "group-controls" }, rangeSeg.el, modeSeg.el, fsBtn), ...(regular ? [group(regular)] : []), h("div", { class: "group-grid" }, side, chartCard));
  renderGroupChart(); renderList();
  activeCharts.set(chartHost, renderGroupChart);
}

/* ================================================================ fullscreen */
const activeCharts = new Map(); // chart host -> redraw()

function fullscreenButton(getTarget, deepLink, labeled = false) {
  const b = h("button", { class: labeled ? "pill tint small fs-btn" : "round small fs-btn", type: "button", onclick: () => toggleFullscreen(getTarget(), deepLink) });
  setFsLabel(b, labeled);
  return b;
}
function setFsLabel(b, labeled = b.classList.contains("pill")) {
  const on = !!document.fullscreenElement, text = on ? t().exitFullscreen : t().fullscreen;
  b.title = text; b.setAttribute("aria-label", text);
  b.replaceChildren(...(labeled ? [icon(on ? "shrink" : "expand"), h("span", {}, on ? t().exitFs : t().fullscreen)] : [icon(on ? "shrink" : "expand")]));
}
async function toggleFullscreen(target, deepLink) {
  if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); return; }
  try { await target.requestFullscreen(); } catch { /* not allowed here: handled below */ }
  await sleep(250);
  // The toolbar popup is a small bubble that cannot go fullscreen: open the same view in a tab, where the button works.
  if (document.fullscreenElement !== target && !IN_TAB) chrome.tabs.create({ url: chrome.runtime.getURL(`popup.html?tab=1&${deepLink}`) });
}
function redrawCharts() { for (const [host, redraw] of activeCharts) { if (!host.isConnected) activeCharts.delete(host); else redraw(); } }
document.addEventListener("fullscreenchange", () => { document.querySelectorAll(".fs-btn").forEach((b) => setFsLabel(b)); requestAnimationFrame(redrawCharts); });
window.addEventListener("resize", debounce(() => { if (document.fullscreenElement) redrawCharts(); }, 150));

/* ===================================================================== settings */
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = h("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function pickImportFile() {
  const file = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  file.addEventListener("change", async () => {
    const f = file.files?.[0]; if (!f) return;
    try { const res = await send("IMPORT_DATA", { data: JSON.parse(await f.text()) }); await reload(); toast(layer, t().imported(res.products, res.history)); }
    catch (e) { toast(layer, `${t().importFail}: ${e.message}`); }
  });
  document.body.append(file); file.click(); file.remove();
}
function openSettings() {
  push({ kind: "settings", refresh: false, backLabel: t().appTitle, build: () => {
    const s = state.settings;
    const themeSeg = segmented({ label: t().theme, value: state.theme, onChange: async (id) => { applyTheme(id); await saveSettings({ theme: id }); },
      items: [["auto", t().themeAuto], ["light", t().themeLight], ["dark", t().themeDark]].map(([id, text]) => ({ id, text })) });
    const langSeg = segmented({ label: t().language, value: state.lang, onChange: async (id) => { state.lang = id; setLang(id); document.documentElement.lang = id; await chrome.storage.sync.set({ language: id }); renderTabbar(); renderRoot(); stack.at(-1)?.render(); },
      items: [{ id: "ru", text: "Русский" }, { id: "en", text: "English" }] });
    const field = (label, control) => h("div", { class: "row row-field" }, h("span", { class: "row-main" }, h("span", { class: "row-title" }, label)), h("span", { class: "row-end grow" }, control));
    return [
      h("h1", { class: "title" }, t().settingsTitle),
      sectionTitle(t().secCheck),
      group(numberRow(t().interval, s.checkIntervalMinutes, { min: 30, max: 1440, onChange: (v) => saveSettings({ checkIntervalMinutes: v }) }),
        switchRow(t().useFetch, s.useFetch, (v) => saveSettings({ useFetch: v })), switchRow(t().globalPause, s.globalPause, (v) => saveSettings({ globalPause: v }))),
      sectionTitle(t().secCharts),
      group(switchRow(t().showRegular, s.showRegularPrice, (v) => saveSettings({ showRegularPrice: v }))),
      sectionTitle(t().secLook), group(field(t().theme, themeSeg.el), field(t().language, langSeg.el)),
      sectionTitle(t().secData),
      group(h("button", { class: "row action", type: "button", onclick: async () => { try { download(`price-tracker-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await send("EXPORT_DATA"))); } catch { /* ignore */ } } }, h("span", { class: "row-title" }, t().export)),
        h("button", { class: "row action", type: "button", onclick: pickImportFile }, h("span", { class: "row-title" }, t().import))),
      h("p", { class: "hint-text" }, t().exportHint),
    ];
  } });
}

/* ================================================== refresh everything, share */
async function refreshAll() {
  state.refreshingAll = true; renderRoot();
  try { await send("REFRESH_ALL"); } catch { state.refreshingAll = false; renderRoot(); return; }
  const poll = async () => {
    await loadProducts();
    let running = true;
    try { running = (await send("GET_STATUS")).running; } catch { running = false; }
    if (running && state.refreshingAll) { renderRoot(); setTimeout(poll, 2000); } else { state.refreshingAll = false; renderRoot(); }
  };
  setTimeout(poll, 1500);
}

const SHARE_MIN_PRODUCTS = 2, SHARE_MIN_DAYS = 3, SHARE_SNOOZE_DAYS = 60;
async function loadShareState() {
  try {
    const s = await chrome.storage.local.get(["firstRunAt", "shareDismissed", "shareHiddenUntil"]);
    let first = Number(s.firstRunAt);
    if (!Number.isFinite(first) || first <= 0) { first = Date.now(); await chrome.storage.local.set({ firstRunAt: first }); }
    state.share = { firstRunAt: first, dismissed: s.shareDismissed === true, hiddenUntil: Number(s.shareHiddenUntil) || 0 };
  } catch { /* storage unavailable: the line simply stays hidden */ }
}
function shareVisible() {
  const s = state.share, now = Date.now();
  return !s.dismissed && s.firstRunAt > 0 && now - s.firstRunAt >= SHARE_MIN_DAYS * DAY && now >= s.hiddenUntil && state.products.length >= SHARE_MIN_PRODUCTS;
}
async function snoozeShare() { state.share.hiddenUntil = Date.now() + SHARE_SNOOZE_DAYS * DAY; try { await chrome.storage.local.set({ shareHiddenUntil: state.share.hiddenUntil }); } catch { /* ignore */ } }
async function dismissShare() { state.share.dismissed = true; try { await chrome.storage.local.set({ shareDismissed: true }); } catch { /* ignore */ } renderRoot(); }
function shareLine() {
  if (!shareVisible()) return null;
  const enc = encodeURIComponent;
  const tg = `https://t.me/share/url?url=${enc(STORE_URL)}&text=${enc(t().shareText)}`;
  const vk = `https://vk.com/share.php?url=${enc(STORE_URL)}`;
  const link = (label, url) => h("a", { class: "share-link", href: url, target: "_blank", rel: "noopener noreferrer", onclick: async (e) => { e.preventDefault(); await snoozeShare(); chrome.tabs.create({ url }); renderRoot(); } }, label);
  const copyBtn = h("button", { class: "share-link", type: "button" }, t().shareCopy);
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(STORE_URL); } catch {
      copyBtn.textContent = t().copyFail; setTimeout(() => { if (copyBtn.isConnected) copyBtn.textContent = t().shareCopy; }, 1800); return;
    }
    await snoozeShare(); copyBtn.textContent = t().copied; setTimeout(() => { if (copyBtn.isConnected) renderRoot(); }, 1300);
  });
  return h("div", { class: "share" }, h("span", { class: "share-msg" }, t().shareMsg), link("Telegram", tg), link("VK", vk), copyBtn, link(t().shareReview, `${STORE_URL}/reviews`),
    h("button", { class: "share-x round small", type: "button", title: t().shareDismiss, "aria-label": t().shareDismiss, onclick: dismissShare }, icon("close")));
}

/* ================================================================ window size */
function applySize(size) { document.documentElement.style.setProperty("--w", `${size.w}px`); document.documentElement.style.setProperty("--h", `${size.h}px`); }
function setupResize() {
  if (IN_TAB) { document.body.classList.add("tab"); return; }
  const cur = { ...DEFAULT_SIZE };
  applySize(cur);
  chrome.storage.local.get("popupSize").then((s) => {
    const saved = s.popupSize;
    if (saved && Number.isFinite(saved.w) && Number.isFinite(saved.h)) { cur.w = clamp(Math.round(saved.w), SIZE_LIMITS.minW, SIZE_LIMITS.maxW); cur.h = clamp(Math.round(saved.h), SIZE_LIMITS.minH, SIZE_LIMITS.maxH); applySize(cur); }
  }).catch(() => {});
  for (const side of ["left", "right"]) {
    const grip = h("div", { class: `grip ${side}`, title: t().resetSize, role: "separator", "aria-label": "Resize" });
    let start = null;
    grip.addEventListener("pointerdown", (e) => { grip.setPointerCapture(e.pointerId); start = { x: e.screenX, y: e.screenY, w: cur.w, h: cur.h }; e.preventDefault(); });
    grip.addEventListener("pointermove", (e) => {
      if (!start) return;
      cur.w = clamp(Math.round(start.w + (side === "right" ? e.screenX - start.x : start.x - e.screenX)), SIZE_LIMITS.minW, SIZE_LIMITS.maxW);
      cur.h = clamp(Math.round(start.h + e.screenY - start.y), SIZE_LIMITS.minH, SIZE_LIMITS.maxH);
      applySize(cur);
    });
    const finish = () => { if (!start) return; start = null; chrome.storage.local.set({ popupSize: { ...cur } }).catch(() => {}); };
    grip.addEventListener("pointerup", finish); grip.addEventListener("pointercancel", finish);
    grip.addEventListener("dblclick", () => { Object.assign(cur, DEFAULT_SIZE); applySize(cur); chrome.storage.local.set({ popupSize: { ...cur } }).catch(() => {}); });
    document.body.append(grip);
  }
}

/* ======================================================================= boot */
(async function init() {
  setupResize();
  app.append(stage, tabbar, layer);
  stage.append(rootScreen.el);
  document.getElementById("root").append(app);
  try { chrome.action.setBadgeText({ text: "" }); } catch { /* ignore */ }
  renderTabbar(); renderRoot();
  const stored = await chrome.storage.sync.get({ ...DEFAULTS, language: "ru" });
  state.lang = stored.language === "en" ? "en" : "ru"; setLang(state.lang); document.documentElement.lang = state.lang;
  Object.keys(DEFAULTS).forEach((k) => { state.settings[k] = stored[k]; });
  applyTheme(stored.theme);
  await loadShareState();
  renderTabbar(); await loadProducts(); renderRoot();
  // deep links from the toolbar popup (it cannot go fullscreen): open straight on the chart that was meant
  const link = new URLSearchParams(location.search);
  const wantGroup = link.get("group"), wantDetail = link.get("detail") ?? link.get("chart");
  if (wantGroup && state.folders.some((f) => f.id === wantGroup)) openGroup(wantGroup);
  else if (wantDetail && state.products.some((p) => p.id === wantDetail)) openDetail(wantDetail);
})();
