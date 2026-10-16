const STR = {
  ru: {
    subtitle: "Локальное отслеживание цен",
    empty: "Нет товаров. Откройте страницу товара на Ozon и нажмите «Отслеживать цену».",
    noMatch: "Ничего не найдено",
    search: "Поиск…",
    sort: { recent: "Недавние", drop: "Сильнее упала", low: "Дешевле", target: "Цель достигнута", name: "По названию" },
    filter: { all: "Все", ozon: "Ozon", wb: "Wildberries", ym: "Яндекс Маркет", active: "Активные", target: "Цель достигнута", error: "Ошибки", paused: "На паузе", unavailable: "Нет в наличии" },
    st: { active: "Активен", error: "Ошибка", paused: "Пауза", target: "Цель!", unavailable: "Нет в наличии" },
    wallet: "С WB Кошельком", lowest: "Мин.", highest: "Макс.", checked: "Проверено", never: "ещё не проверялся",
    targetPh: "Целевая цена, ₽", save: "Сохранить", clear: "Сбросить",
    refresh: "Проверить", retry: "Повторить", pause: "Пауза", resume: "Возобновить", chart: "График", remove: "Удалить",
    confirmRemove: "Удалить товар и всю его историю?",
    range30: "30 дн.", range90: "90 дн.", rangeAll: "Всё", card: "С Ozon Картой", regular: "Обычная цена", withoutCard: "Без карты", oldPrice: "Старая цена", payLabel: "с Яндекс Пэй", promo: (c, p) => `Промокод ${c}${p ? ` −${p}%` : ""}`, promoTip: (c, v) => `Нажмите, чтобы скопировать.${v ? ` Ориентировочно с промокодом: ${v}.` : ""} Цена в трекере — без промокода.`, copied: "Скопировано",
    noHistory: "Недостаточно данных для графика", since: (d, n) => `Отслеживается с ${d} · ${n} дн. данных`,
    settings: "Настройки", back: "← Назад", refreshAll: "Проверить все", openTab: "Открыть во вкладке (любой размер)", resetSize: "Размер по умолчанию",
    globalPaused: "Автопроверка приостановлена в настройках.",
    interval: "Интервал проверки, мин (от 30)", notifications: "Уведомления",
    dropPercent: "Уведомлять о снижении от, % (0 — выкл.)", notifyLow: "Минимальная цена за всё время",
    notifyStock: "Товар снова в наличии", globalPause: "Приостановить автопроверку", useFetch: "Проверять без открытия вкладок",
    data: "Данные", export: "Экспорт", import: "Импорт",
    exportHint: "Копия всех товаров и истории цен в JSON-файле.",
    saved: "Сохранено", imported: (p, h) => `Импортировано: товаров ${p}, записей ${h}`, importFail: "Не удалось импортировать",
    invalidTarget: "Введите корректную цену",
    ins: {
      lowest: "Минимум за 30 дн.", near: "Близко к минимуму", above: "Дороже обычного", fair: "Цена обычная",
      real: (n) => `Реальная скидка −${n}% к медиане`, fake: "Скидка ненастоящая",
      collecting: (n) => `Копим историю: ${n} дн.`, pending: (v) => `⚠ Цена ${v} не подтверждена`,
      tipFake: "Цена недавно снижена, но не ниже обычной за 90 дней",
      tip: (a, b, c) => `Медиана 30 дн.: ${a} · 90 дн.: ${b} · мин. 30 дн.: ${c}`,
    },
    verified: "Подтверждено",
    savings: (sum, n) => `Цены упали на ${sum} по ${n} тов. с начала отслеживания`,
    health: (store, n, err) => `${store}: ${n} проверок подряд не удались — возможно, изменилась вёрстка страницы или сайт показал проверку.${err ? ` Последняя ошибка: ${err}` : ""}`,
    alertLowDays: "Уведомлять о минимуме за N дней (0 — выкл.)",
    alertBelowHighPct: "Уведомлять, если цена ниже максимума за 90 дн. на, % (0 — выкл.)",
    digestMode: "Присылать уведомления одним дайджестом раз в день (9:00)",
    digestHint: "Целевые цены всегда приходят сразу.",
  },
  en: {
    subtitle: "Local price tracking",
    empty: "No products yet. Open an Ozon product page and press “Track price”.",
    noMatch: "Nothing found",
    search: "Search…",
    sort: { recent: "Recent", drop: "Biggest drop", low: "Cheapest", target: "Target reached", name: "By name" },
    filter: { all: "All", ozon: "Ozon", wb: "Wildberries", ym: "Yandex Market", active: "Active", target: "Target reached", error: "Errors", paused: "Paused", unavailable: "Unavailable" },
    st: { active: "Active", error: "Error", paused: "Paused", target: "Target!", unavailable: "Unavailable" },
    wallet: "With WB Wallet", lowest: "Low", highest: "High", checked: "Checked", never: "not checked yet",
    targetPh: "Target price, ₽", save: "Save", clear: "Clear",
    refresh: "Check", retry: "Retry", pause: "Pause", resume: "Resume", chart: "Chart", remove: "Delete",
    confirmRemove: "Delete this product and its whole history?",
    range30: "30 d", range90: "90 d", rangeAll: "All", card: "Ozon Card", regular: "Regular price", withoutCard: "Without card", oldPrice: "Old price", payLabel: "with Yandex Pay", promo: (c, p) => `Promo ${c}${p ? ` −${p}%` : ""}`, promoTip: (c, v) => `Click to copy.${v ? ` Roughly with the code: ${v}.` : ""} The tracked price excludes the code.`, copied: "Copied",
    noHistory: "Not enough data for a chart", since: (d, n) => `Tracked since ${d} · ${n} d of data`,
    settings: "Settings", back: "← Back", refreshAll: "Check all", openTab: "Open in a tab (any size)", resetSize: "Default size",
    globalPaused: "Automatic checks are paused in settings.",
    interval: "Check interval, min (30+)", notifications: "Notifications",
    dropPercent: "Notify on a drop of at least, % (0 = off)", notifyLow: "All-time low price",
    notifyStock: "Back in stock", globalPause: "Pause automatic checks", useFetch: "Check without opening tabs",
    data: "Data", export: "Export", import: "Import",
    exportHint: "A JSON copy of all products and price history.",
    saved: "Saved", imported: (p, h) => `Imported: ${p} products, ${h} records`, importFail: "Import failed",
    invalidTarget: "Enter a valid price",
    ins: {
      lowest: "Lowest in 30 days", near: "Near the lowest", above: "Above usual", fair: "Usual price",
      real: (n) => `Real discount −${n}% vs median`, fake: "Fake discount",
      collecting: (n) => `Collecting history: ${n} d`, pending: (v) => `⚠ Price ${v} unconfirmed`,
      tipFake: "The price was cut recently but is not below its usual 90-day level",
      tip: (a, b, c) => `30-day median: ${a} · 90-day: ${b} · 30-day low: ${c}`,
    },
    verified: "Verified",
    savings: (sum, n) => `Prices fell by ${sum} across ${n} products since tracking began`,
    health: (store, n, err) => `${store}: ${n} checks in a row failed — the page layout may have changed or the site showed a check.${err ? ` Last error: ${err}` : ""}`,
    alertLowDays: "Alert on lowest price in N days (0 = off)",
    alertBelowHighPct: "Alert when price is below the 90-day high by, % (0 = off)",
    digestMode: "Send alerts as one daily digest (9:00)",
    digestHint: "Target-price alerts always arrive immediately.",
  },
};

const DEFAULTS = { checkIntervalMinutes: 60, notificationsEnabled: true, dropPercent: 0, notifyLow: true, notifyStock: true, globalPause: false, useFetch: true, alertLowDays: 0, alertBelowHighPct: 0, digestMode: false };
const DAY = 864e5;
const IN_TAB = new URLSearchParams(location.search).has("tab");
const SIZE_LIMITS = { minW: 340, maxW: 800, minH: 300, maxH: 600 }; // Chrome caps popups at 800x600
const DEFAULT_SIZE = { w: 440, h: 320 };

const state = {
  lang: "ru", view: "list", products: [], settings: { ...DEFAULTS },
  insights: null, health: {},
  q: "", sort: "recent", filter: "all", open: new Set(), busy: new Set(), refreshingAll: false, msg: null,
};
const chartPrefs = new Map(); // productId -> { range, kind }

const t = () => STR[state.lang];
const money = (v) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(v);
const dateTime = (v) => new Intl.DateTimeFormat(state.lang === "en" ? "en-GB" : "ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(v);
const dateShort = (v) => new Intl.DateTimeFormat(state.lang === "en" ? "en-GB" : "ru-RU", { day: "2-digit", month: "short" }).format(v);

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== "list") el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid !== undefined && kid !== null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload }).then((res) => {
    if (res && typeof res === "object" && typeof res.error === "string") throw new Error(res.error);
    return res;
  });
}

const isTargetReached = (p) => p.targetPrice !== undefined && p.currentPrice <= p.targetPrice;
const statusOf = (p) => (p.trackingStatus === "paused" ? "paused" : p.trackingStatus === "error" ? "error" : p.availability === "unavailable" ? "unavailable" : isTargetReached(p) ? "target" : "active");
const dropPct = (p) => (p.previousPrice && p.previousPrice > p.currentPrice ? (p.previousPrice - p.currentPrice) / p.previousPrice : 0);

function visibleProducts() {
  const q = state.q.trim().toLowerCase();
  const list = state.products.filter((p) => {
    if (q && !p.title.toLowerCase().includes(q)) return false;
    switch (state.filter) {
      case "ozon": return !p.store;
      case "wb": return p.store === "wb";
      case "ym": return p.store === "ym";
      case "active": return p.trackingStatus === "active";
      case "target": return isTargetReached(p);
      case "error": return p.trackingStatus === "error";
      case "paused": return p.trackingStatus === "paused";
      case "unavailable": return p.availability === "unavailable";
      default: return true;
    }
  });
  const by = {
    recent: (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    drop: (a, b) => dropPct(b) - dropPct(a),
    low: (a, b) => a.currentPrice - b.currentPrice,
    target: (a, b) => Number(isTargetReached(b)) - Number(isTargetReached(a)),
    name: (a, b) => a.title.localeCompare(b.title, state.lang),
  };
  return list.sort(by[state.sort]);
}

async function loadProducts() {
  try { state.products = await send("GET_PRODUCTS"); } catch { state.products = []; }
  try { state.insights = await send("GET_INSIGHTS"); } catch { state.insights = null; }
  try { state.health = (await chrome.storage.local.get("health")).health ?? {}; } catch { state.health = {}; }
}

async function reload() { await loadProducts(); render(); }

async function act(id, fn) {
  state.busy.add(id); render();
  try { await fn(); } catch { /* error is surfaced via product status */ }
  state.busy.delete(id);
  await reload();
}

/* ---------- chart ---------- */
async function buildChart(p, box) {
  const pref = chartPrefs.get(p.id) ?? { range: 90 };
  chartPrefs.set(p.id, pref);
  let history = [];
  try { history = await send("GET_HISTORY", { productId: p.id, since: pref.range ? Date.now() - pref.range * DAY : 0 }); } catch { /* empty */ }
  const isCard = p.historyPriceKind === "ozon_card";
  const now = Date.now();
  const mk = (kind, color, label, current) => {
    const pts = history.filter((x) => (x.priceKind ?? "unknown") === kind).sort((a, b) => a.timestamp - b.timestamp);
    // Extend the line to "now" so a freshly tracked product still gets a chart.
    if (current && (!pts.length || now - pts.at(-1).timestamp > 6e4)) pts.push({ timestamp: now, price: current });
    return { kind, color, label, pts };
  };
  const series = [];
  if (isCard) {
    series.push(mk("ozon_card", "#005bff", t().card, p.currentPrice));
    const reg = mk("unknown", "#f0883e", t().withoutCard, p.regularPrice);
    if (reg.pts.length) series.push(reg);
  } else {
    series.push(mk("unknown", "#005bff", t().regular, p.currentPrice));
  }

  const controls = h("div", { class: "chart-controls" },
    [[30, t().range30], [90, t().range90], [0, t().rangeAll]].map(([r, label]) =>
      h("button", { class: `btn plain${pref.range === r ? " on" : ""}`, onclick: () => { pref.range = r; refreshChart(p, box); } }, label)),
    series.length > 1 ? series.map((s) => h("span", { class: "legend" }, h("i", { style: `background:${s.color}` }), s.label)) : null);

  box.replaceChildren(controls);
  const startedAt = p.createdAt ?? Math.min(...history.map((x) => x.timestamp), now);
  const sinceDate = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(startedAt);
  box.append(h("div", { class: "since" }, t().since(sinceDate, Math.max(1, Math.ceil((now - startedAt) / DAY)))));
  const all = series.flatMap((s) => s.pts);
  if (!series.some((s) => s.pts.length >= 2)) { box.append(h("div", { class: "note" }, t().noHistory)); return; }

  const W = 400, H = 150, L = 8, R = 8, T = 18, B = 22;
  const minX = Math.min(...all.map((x) => x.timestamp)), maxX = Math.max(...all.map((x) => x.timestamp));
  let minY = Math.min(...all.map((x) => x.price)), maxY = Math.max(...all.map((x) => x.price));
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const px = (x) => L + ((x - minX) / (maxX - minX || 1)) * (W - L - R);
  const py = (y) => T + (1 - (y - minY) / (maxY - minY)) * (H - T - B);
  const NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs, text) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": t().chart });
  for (const s of series) {
    if (!s.pts.length) continue;
    svg.append(el("polyline", { points: s.pts.map((x) => `${px(x.timestamp).toFixed(1)},${py(x.price).toFixed(1)}`).join(" "), fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round" }));
    for (const x of s.pts) {
      const c = el("circle", { cx: px(x.timestamp).toFixed(1), cy: py(x.price).toFixed(1), r: 3, fill: s.color });
      c.append(el("title", {}, `${s.label} · ${dateShort(x.timestamp)}: ${money(x.price)}`));
      svg.append(c);
    }
  }
  const label = (x, text, dy, color) => {
    const cx = px(x.timestamp);
    svg.append(el("text", { x: Math.min(Math.max(cx, 34), W - 34), y: py(x.price) + dy, "text-anchor": "middle", "font-size": 10, fill: color }, text));
  };
  const hi = all.reduce((a, b) => (b.price > a.price ? b : a)), lo = all.reduce((a, b) => (b.price < a.price ? b : a));
  label(hi, money(hi.price), -6, "#c14937");
  if (lo.price !== hi.price) label(lo, money(lo.price), 14, "#168345");
  svg.append(el("text", { x: L, y: H - 5, "font-size": 10, fill: "#68758a" }, dateShort(minX)));
  svg.append(el("text", { x: W - R, y: H - 5, "font-size": 10, fill: "#68758a", "text-anchor": "end" }, dateShort(maxX)));
  box.append(svg);
}
const refreshChart = (p, box) => buildChart(p, box);

/* ---------- list ---------- */
function pills(p) {
  const ins = state.insights?.byId?.[p.id];
  const L = t().ins;
  const out = [];
  if (p.promoCode) {
    const est = p.promoPercent ? money(Math.round(p.currentPrice * (1 - p.promoPercent / 100))) : "";
    const pill = h("span", { class: "pill good copy", title: t().promoTip(p.promoCode, est) }, t().promo(p.promoCode, p.promoPercent));
    pill.addEventListener("click", () => {
      navigator.clipboard?.writeText(p.promoCode).then(() => { pill.textContent = t().copied; setTimeout(() => { pill.textContent = t().promo(p.promoCode, p.promoPercent); }, 1200); }).catch(() => {});
    });
    out.push(pill);
  }
  if (p.pendingPrice) out.push(h("span", { class: "pill warn" }, L.pending(money(p.pendingPrice.value))));
  if (ins) {
    const tip = L.tip(ins.median30 ? money(ins.median30) : "–", ins.median90 ? money(ins.median90) : "–", ins.min30 ? money(ins.min30) : "–");
    if (ins.buy === "lowest") out.push(h("span", { class: "pill good", title: tip }, L.lowest));
    else if (ins.buy === "near") out.push(h("span", { class: "pill good", title: tip }, L.near));
    else if (ins.buy === "above") out.push(h("span", { class: "pill warn", title: tip }, L.above));
    else if (ins.buy === "fair") out.push(h("span", { class: "pill", title: tip }, L.fair));
    else out.push(h("span", { class: "pill", title: tip }, L.collecting(Math.floor(ins.span))));
    if (ins.discount === "real") out.push(h("span", { class: "pill good", title: tip }, L.real(ins.discountPct)));
    else if (ins.discount === "fake") out.push(h("span", { class: "pill bad", title: L.tipFake }, L.fake));
  }
  return out.length ? h("div", { class: "pills" }, out) : null;
}

function healthBanners() {
  const names = { ozon: "Ozon", wb: "Wildberries", ym: "Яндекс Маркет" };
  return Object.entries(names)
    .filter(([k]) => (state.health[k]?.fails ?? 0) >= 3 && state.products.some((p) => (p.store ?? "ozon") === k))
    .map(([k, name]) => h("div", { class: "banner bad" }, t().health(name, state.health[k].fails, state.health[k].lastError)));
}

function summaryBox() {
  const sm = state.insights?.summary;
  if (!sm || !sm.dropped || !sm.totalDrop) return null;
  return h("div", { class: "summary" }, t().savings(money(sm.totalDrop), sm.dropped));
}

function card(p) {
  const status = statusOf(p), busy = state.busy.has(p.id), paused = p.trackingStatus === "paused";
  const delta = p.previousPrice && p.previousPrice !== p.currentPrice ? p.currentPrice - p.previousPrice : 0;
  const img = typeof p.imageUrl === "string" && p.imageUrl.startsWith("https://") ? p.imageUrl : null;
  const input = h("input", { type: "number", min: "2", step: "1", placeholder: t().targetPh, value: p.targetPrice ?? "", "aria-label": t().targetPh });
  const chartBox = h("div", { class: "chart" });
  const chartOpen = state.open.has(p.id);

  const saveTarget = (value) => act(p.id, () => send("SET_TARGET", { id: p.id, targetPrice: value }));
  const el = h("article", { class: `card${paused ? " paused" : ""}` },
    h("div", { class: "card-top" },
      img ? h("img", { src: img, alt: "", referrerPolicy: "no-referrer" }) : null,
      h("div", { class: "card-body" },
        h("div", { class: "title-row" },
          h("a", { href: p.canonicalUrl ?? p.url, target: "_blank", rel: "noopener noreferrer", title: p.title }, p.title),
          h("span", { class: "status" }, p.store === "wb" ? "WB" : p.store === "ym" ? "YM" : "Ozon"),
          h("span", { class: `status ${status}` }, t().st[status])),
        h("div", { class: "price-row" },
          h("strong", {}, money(p.currentPrice)),
          p.historyPriceKind === "ozon_card" ? h("span", { class: "muted" }, t().card) : null,
          p.priceBadge === "pay" ? h("span", { class: "muted" }, t().payLabel) : null,
          delta ? h("span", { class: delta < 0 ? "down" : "up" }, `${delta < 0 ? "▼" : "▲"} ${money(Math.abs(delta))}`) : null),
        pills(p),
        h("div", { class: "meta" },
          p.historyPriceKind === "ozon_card" && p.regularPrice ? h("span", {}, `${t().withoutCard}: ${money(p.regularPrice)}`) : null,
          p.store === "ym" && p.regularPrice ? h("span", {}, `${t().oldPrice}: ${money(p.regularPrice)}${p.discountPercent ? ` (−${p.discountPercent}%)` : ""}`) : null,
          p.walletPrice ? h("span", {}, `${t().wallet}: ${money(p.walletPrice)}`) : null,
          h("span", {}, `${t().lowest}: ${money(p.lowestPrice)}`),
          h("span", {}, `${t().highest}: ${money(p.highestPrice)}`),
          h("span", { title: p.lastVerifiedAt ? `${t().verified}: ${dateTime(p.lastVerifiedAt)}` : undefined }, `${t().checked}: ${p.lastCheckedAt ? dateTime(p.lastCheckedAt) : t().never}`)),
        p.trackingStatus === "error" && p.lastError ? h("div", { class: "err" }, p.lastError) : null)),
    h("div", { class: "target-row" }, input,
      h("button", { class: "btn", disabled: busy, onclick: () => {
        const v = Number(input.value);
        if (input.value.trim() === "" || !(v > 1 && v < 1e8)) { input.setCustomValidity(t().invalidTarget); input.reportValidity(); input.setCustomValidity(""); return; }
        saveTarget(Math.round(v));
      } }, t().save),
      p.targetPrice !== undefined ? h("button", { class: "btn plain", disabled: busy, onclick: () => saveTarget(undefined) }, t().clear) : null),
    h("div", { class: "actions" },
      h("button", { class: "btn", disabled: busy, onclick: () => act(p.id, () => send("REFRESH_PRODUCT", { id: p.id })) }, p.trackingStatus === "error" ? t().retry : t().refresh),
      h("button", { class: "btn plain", disabled: busy, onclick: () => act(p.id, () => send("PAUSE_PRODUCT", { id: p.id, paused: !paused })) }, paused ? t().resume : t().pause),
      h("button", { class: "btn plain", onclick: () => { state.open.has(p.id) ? state.open.delete(p.id) : state.open.add(p.id); render(); } }, t().chart),
      h("button", { class: "btn danger", disabled: busy, onclick: () => { if (confirm(t().confirmRemove)) act(p.id, () => send("UNTRACK_PRODUCT", { id: p.id })); } }, t().remove)),
    chartOpen ? chartBox : null);
  if (chartOpen) buildChart(p, chartBox);
  return el;
}

function listView() {
  const searchInput = h("input", { type: "search", placeholder: t().search, value: state.q, "aria-label": t().search });
  searchInput.addEventListener("input", () => { state.q = searchInput.value; renderList(); });
  const mkSelect = (opts, cur, onChange) => {
    const s = h("select", {}, Object.entries(opts).map(([k, v]) => h("option", { value: k, selected: k === cur }, v)));
    s.addEventListener("change", () => onChange(s.value));
    return s;
  };
  const listBox = h("div", { class: "list", id: "list" });
  const wrap = h("div", {},
    state.settings.globalPause ? h("div", { class: "banner" }, t().globalPaused) : null,
    healthBanners(),
    summaryBox(),
    h("div", { class: "toolbar" }, searchInput,
      mkSelect(t().filter, state.filter, (v) => { state.filter = v; renderList(); }),
      mkSelect(t().sort, state.sort, (v) => { state.sort = v; renderList(); })),
    listBox);
  wrap._fill = () => {
    const items = visibleProducts();
    listBox.replaceChildren(...(items.length ? items.map(card) : [h("div", { class: "empty" }, state.products.length ? t().noMatch : t().empty)]));
  };
  wrap._fill();
  return wrap;
}

function renderList() {
  const box = document.getElementById("list");
  if (!box) return render();
  const items = visibleProducts();
  box.replaceChildren(...(items.length ? items.map(card) : [h("div", { class: "empty" }, state.products.length ? t().noMatch : t().empty)]));
}

/* ---------- settings ---------- */
async function saveSettings(patch) {
  Object.assign(state.settings, patch);
  await chrome.storage.sync.set(patch);
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = h("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function settingsView() {
  const s = state.settings;
  const check = (key, label) => h("label", { class: "field" }, h("span", {}, label),
    h("input", { type: "checkbox", checked: !!s[key], onchange: (e) => saveSettings({ [key]: e.target.checked }) }));
  const num = (key, label, min, fallback, max = 1e6) => h("label", { class: "field" }, h("span", {}, label),
    h("input", { type: "number", min: String(min), step: "1", value: s[key], onchange: (e) => {
      const v = Math.min(max, Math.max(min, Math.round(Number(e.target.value)) || fallback));
      e.target.value = v; saveSettings({ [key]: v });
    } }));
  const file = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const res = await send("IMPORT_DATA", { data: JSON.parse(await f.text()) });
      state.msg = { text: t().imported(res.products, res.history) };
      await loadProducts();
    } catch (e) { state.msg = { text: `${t().importFail}: ${e.message}`, bad: true }; }
    render();
  });
  return h("div", { class: "settings" },
    h("section", { class: "panel" },
      num("checkIntervalMinutes", t().interval, 30, 60),
      check("useFetch", t().useFetch),
      check("globalPause", t().globalPause)),
    h("section", { class: "panel" },
      h("h2", {}, t().notifications),
      check("notificationsEnabled", t().notifications),
      num("dropPercent", t().dropPercent, 0, 0),
      check("notifyLow", t().notifyLow),
      check("notifyStock", t().notifyStock),
      num("alertLowDays", t().alertLowDays, 0, 0, 365),
      num("alertBelowHighPct", t().alertBelowHighPct, 0, 0, 95),
      check("digestMode", t().digestMode),
      h("p", { class: "hint" }, t().digestHint)),
    h("section", { class: "panel" },
      h("h2", {}, t().data),
      h("p", { class: "hint" }, t().exportHint),
      h("div", { class: "actions" },
        h("button", { class: "btn", onclick: async () => {
          try { download(`ozon-price-tracker-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await send("EXPORT_DATA"))); } catch { /* ignore */ }
        } }, t().export),
        h("button", { class: "btn plain", onclick: () => file.click() }, t().import), file),
      state.msg ? h("div", { class: `msg${state.msg.bad ? " bad" : ""}` }, state.msg.text) : null));
}

/* ---------- shell ---------- */
function render() {
  const settings = state.view === "settings";
  const root = document.getElementById("root");
  document.documentElement.lang = state.lang;
  root.replaceChildren(h("main", {},
    h("header", {},
      h("div", {}, h("h1", {}, "Price Tracker"), h("p", {}, settings ? t().settings : t().subtitle)),
      h("div", { class: "header-actions" },
        settings ? h("button", { class: "language", onclick: () => { state.view = "list"; state.msg = null; render(); } }, t().back) : [
          h("button", { class: "icon", title: t().refreshAll, "aria-label": t().refreshAll, disabled: state.refreshingAll || !state.products.length, onclick: refreshAll }, state.refreshingAll ? "…" : "⟳"),
          IN_TAB ? null : h("button", { class: "icon", title: t().openTab, "aria-label": t().openTab, onclick: () => chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?tab=1") }) }, "⤢"),
          h("button", { class: "icon", title: t().settings, "aria-label": t().settings, onclick: () => { state.view = "settings"; render(); } }, "⚙"),
        ],
        h("button", { class: "language", onclick: async () => { state.lang = state.lang === "ru" ? "en" : "ru"; await chrome.storage.sync.set({ language: state.lang }); render(); } }, state.lang.toUpperCase()))),
    settings ? settingsView() : listView()));
}

async function refreshAll() {
  state.refreshingAll = true; render();
  try { await send("REFRESH_ALL"); } catch { state.refreshingAll = false; render(); return; }
  const poll = async () => {
    await loadProducts();
    let running = true;
    try { running = (await send("GET_STATUS")).running; } catch { running = false; }
    if (running && state.refreshingAll) { render(); setTimeout(poll, 2000); }
    else { state.refreshingAll = false; render(); }
  };
  setTimeout(poll, 1500);
}

/* ---------- mouse resizing (popup only; a tab resizes with its window) ---------- */
function applySize(size) {
  document.documentElement.style.setProperty("--w", `${size.w}px`);
  document.documentElement.style.setProperty("--h", `${size.h}px`);
}

function setupResize() {
  if (IN_TAB) { document.body.classList.add("tab"); return; }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)));
  const cur = { ...DEFAULT_SIZE };
  chrome.storage.local.get("popupSize").then((s) => {
    const saved = s.popupSize;
    if (saved && Number.isFinite(saved.w) && Number.isFinite(saved.h)) {
      cur.w = clamp(saved.w, SIZE_LIMITS.minW, SIZE_LIMITS.maxW);
      cur.h = clamp(saved.h, SIZE_LIMITS.minH, SIZE_LIMITS.maxH);
      applySize(cur);
    }
  }).catch(() => {});

  for (const side of ["left", "right"]) {
    const grip = h("div", { class: `grip ${side}`, title: t().resetSize + " — double-click", role: "separator", "aria-label": "Resize" });
    let start = null;
    grip.addEventListener("pointerdown", (e) => {
      grip.setPointerCapture(e.pointerId);
      start = { x: e.screenX, y: e.screenY, w: document.body.getBoundingClientRect().width, h: Math.max(document.body.getBoundingClientRect().height, window.innerHeight) };
      e.preventDefault();
    });
    grip.addEventListener("pointermove", (e) => {
      if (!start) return;
      const dx = e.screenX - start.x, dy = e.screenY - start.y;
      cur.w = clamp(start.w + (side === "right" ? dx : -dx), SIZE_LIMITS.minW, SIZE_LIMITS.maxW);
      cur.h = clamp(start.h + dy, SIZE_LIMITS.minH, SIZE_LIMITS.maxH);
      applySize(cur);
    });
    const finish = () => {
      if (!start) return;
      start = null;
      chrome.storage.local.set({ popupSize: { ...cur } }).catch(() => {});
    };
    grip.addEventListener("pointerup", finish);
    grip.addEventListener("pointercancel", finish);
    grip.addEventListener("dblclick", () => {
      Object.assign(cur, DEFAULT_SIZE);
      applySize(cur);
      chrome.storage.local.set({ popupSize: { ...cur } }).catch(() => {});
    });
    document.body.append(grip);
  }
}

(async function init() {
  setupResize();
  try { chrome.action.setBadgeText({ text: "" }); } catch { /* ignore */ }
  const stored = await chrome.storage.sync.get({ ...DEFAULTS, language: "ru" });
  state.lang = stored.language === "en" ? "en" : "ru";
  for (const k of Object.keys(DEFAULTS)) state.settings[k] = stored[k];
  await loadProducts();
  render();
})();
