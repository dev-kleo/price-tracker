(function () {
  "use strict";
  if (window.__optAeLoaded) return;
  window.__optAeLoaded = true;

  const ROOT_ID = "ae-price-tracker-root";

  // Everything that depends on AliExpress markup lives here, so it is the only place to fix when the site changes.
  // Checked on live aliexpress.ru product pages (Oct 2026).
  const SEL = {
    price: "[data-unformatted-price]",                       // attribute holds the displayed price as plain digits, e.g. "133735"
    priceText: '[class*="SnowPrice__mainM"]',                // visible main price ("133 735 ₽"); fallback when the attribute is missing
    title: "h1",
    skuProp: 'div[class*="SkuPropertyItem__skuProp"]',       // one block per variant property
    skuPropName: '[class*="propNameWrap"]',                  // "Цвет: Black For Type C" (name and the selected value)
  };
  const SOLD_RE = /^(?:товар\s+уже\s+раскупили|нет\s+в\s+продаже)\.?$/i;                       // texts of the site's own out-of-stock block
  const REMOVED_RE = /страница\s+товара\s+не\s+существует|такой\s+страницы\s+нет/i;            // 404 page
  const BLOCK_RE = /пройдите\s+проверку|_tmd_\/punish|_____tmd_____/i;                         // bot check
  const SKU_GRACE_MS = 3000;                                                                    // the page writes sku_id into the URL a moment after load

  const asNumber = (v) => {
    const n = typeof v === "string" ? Number(v.replace(/\s/g, "").replace(",", ".")) : v;
    return typeof n === "number" && Number.isFinite(n) && n > 1 && n < 1e8 ? Math.round(n) : null;
  };

  function parseLocation(url = location.href) {
    try {
      const u = new URL(url);
      if (u.hostname !== "aliexpress.ru" && u.hostname !== "www.aliexpress.ru") return null;
      const item = u.pathname.match(/\/item\/(\d{6,20})\.html$/i)?.[1];
      if (!item) return null;
      const sku = u.searchParams.get("sku_id");
      return { item, sku: sku && /^\d{6,25}$/.test(sku) ? sku : null };
    } catch {
      return null;
    }
  }

  const productId = (loc) => `ae:${loc.item}${loc.sku ? `:${loc.sku}` : ""}`;
  const canonicalOf = (loc) => `https://aliexpress.ru/item/${loc.item}.html${loc.sku ? `?sku_id=${loc.sku}` : ""}`;

  // sku_id in the address bar is the selected variant. Without it (just after load) we wait a few seconds, then fall back to the
  // product-level price under the id without a variant.
  const seenAt = new Map();
  function variantReady(loc) {
    if (loc.sku) return true;
    if (!seenAt.has(loc.item)) seenAt.set(loc.item, Date.now());
    return Date.now() - seenAt.get(loc.item) > SKU_GRACE_MS;
  }

  function variantLabel() {
    const parts = [];
    for (const p of document.querySelectorAll(SEL.skuProp)) {
      const wrap = p.querySelector(SEL.skuPropName);
      // "Цвет:" and the selected value are separate spans without whitespace between them
      const t = wrap ? [...wrap.children].map((c) => c.textContent.trim()).filter(Boolean).join(" ") || wrap.textContent.replace(/\s+/g, " ").trim() : "";
      if (t) parts.push(t);
    }
    const s = parts.join(" · ");
    return s ? s.slice(0, 160) : null;
  }

  function snapshot() {
    const loc = parseLocation();
    if (!loc || !variantReady(loc)) return null;
    // The public displayed price: what a logged-out visitor sees as the product price. The "price with coupon" next to it and
    // account-specific amounts (coupons, "price for you") are deliberately NOT recorded.
    const priceEl = document.querySelector(SEL.price);
    const price = asNumber(priceEl?.getAttribute("data-unformatted-price")) ?? asNumber((document.querySelector(SEL.priceText)?.textContent ?? "").replace(/[^\d ,. ]/g, ""));
    const title = (document.querySelector(SEL.title)?.textContent ?? "").trim();
    if (price === null || title.length < 2) return null;
    const img = document.querySelector('meta[property="og:image"]')?.content;
    return {
      ozonProductId: productId(loc),
      title,
      url: canonicalOf(loc),
      canonicalUrl: canonicalOf(loc),
      imageUrl: typeof img === "string" && img.startsWith("https://") ? img : undefined,
      price: { value: price, source: "ae-dom", confidence: 0.95 },
      variantLabel: loc.sku ? variantLabel() : null,
      availability: "available",
    };
  }

  function leafMatch(root, re) {
    if (!root) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, " ").trim();
      if (t.length > 0 && t.length <= 60 && re.test(t) && !n.parentElement?.closest("a, script, style")) return n.parentElement;
    }
    return null;
  }

  // Positive "not available" signal, or null. A removed product shows the 404 page; a sold-out one shows the site's own out-of-stock
  // block, which is only trusted when no price is on the page. The removed page has no variant, so the whole item is meant.
  function unavailableSignal() {
    const loc = parseLocation();
    if (!loc) return null;
    const ozonProductId = `ae:${loc.item}`;
    if (REMOVED_RE.test(document.title) || (!document.querySelector(SEL.title) && leafMatch(document.body, REMOVED_RE))) return { unavailable: true, reason: "removed", ozonProductId };
    if (!document.querySelector(SEL.price) && leafMatch(document.querySelector("main") ?? document.body, SOLD_RE)) return { unavailable: true, reason: "out_of_stock", ozonProductId: productId(loc) };
    return null;
  }

  function blocked() {
    return !!parseLocation() && (BLOCK_RE.test(document.title) || BLOCK_RE.test(location.href));
  }

  const send = (msg) =>
    chrome.runtime.sendMessage(msg).then((res) => {
      if (res && typeof res === "object" && typeof res.error === "string") throw new Error(res.error);
      return res;
    });

  let lang = "ru";
  let renderedKey = "";
  let lastSentKey = "";
  let lastSentAt = 0;
  let timer = 0;

  async function update() {
    const snap = snapshot();
    if (!snap) {
      renderedKey = "";
      document.getElementById(ROOT_ID)?.remove();
      const ua = unavailableSignal();
      if (ua) {
        const gone = `${ua.ozonProductId}:gone`;
        if (gone !== lastSentKey || Date.now() - lastSentAt > 3e5) {
          lastSentKey = gone;
          lastSentAt = Date.now();
          send({ type: "PAGE_UNAVAILABLE", ozonProductId: ua.ozonProductId, reason: ua.reason }).catch(() => {});
        }
      }
      return;
    }
    const key0 = `${snap.ozonProductId}:${snap.price.value}`;
    if (key0 !== lastSentKey || Date.now() - lastSentAt > 3e5) {
      lastSentKey = key0;
      lastSentAt = Date.now();
      send({ type: "AE_OBSERVATION", snapshot: snap }).catch(() => {});
    }
    const tracked = await send({ type: "GET_PRODUCT", ozonProductId: snap.ozonProductId }).catch(() => undefined);
    const key = `${key0}:${!!tracked}:${lang}`;
    if (key === renderedKey && document.getElementById(ROOT_ID)) return;
    renderedKey = key;
    document.getElementById(ROOT_ID)?.remove();

    const L = lang === "en"
      ? { tracked: "✓ Tracking price", track: "＋ Track price", stop: "Stop tracking price", retry: "Try again" }
      : { tracked: "✓ Цена отслеживается", track: "＋ Отслеживать цену", stop: "Отключить отслеживание цены", retry: "Повторить" };
    const host = document.createElement("div");
    host.id = ROOT_ID;
    Object.assign(host.style, { position: "fixed", right: "18px", bottom: "18px", zIndex: "2147483647", fontFamily: "Arial,sans-serif" });
    const shadow = host.attachShadow({ mode: "open" });
    const btn = document.createElement("button");
    btn.textContent = tracked ? L.tracked : L.track;
    btn.setAttribute("aria-label", tracked ? L.stop : L.track);
    btn.style.cssText = "border:0;border-radius:12px;padding:12px 16px;background:#e62e04;color:#fff;font-weight:700;box-shadow:0 4px 18px #0003;cursor:pointer";
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        if (tracked) await send({ type: "UNTRACK_PRODUCT", id: tracked.id });
        else await send({ type: "AE_TRACK", snapshot: snap });
        renderedKey = "";
        await update();
      } catch {
        btn.textContent = L.retry;
      } finally {
        btn.disabled = false;
      }
    };
    shadow.append(btn);
    document.documentElement.append(host);
  }

  // Debounced, so a burst of DOM changes (and a variant click that rewrites price and URL) saves one observation, not many.
  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void update(), 900);
  };

  // Single-page app: the price and the sku_id in the URL change without a reload.
  new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-unformatted-price"] });
  window.addEventListener("popstate", schedule);
  let lastHref = location.href;
  window.setInterval(() => { if (location.href !== lastHref) { lastHref = location.href; schedule(); } }, 800); // pushState/replaceState fire no event

  chrome.storage.sync.get("language").then((s) => {
    lang = s.language === "en" ? "en" : "ru";
    schedule();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.language) {
      lang = changes.language.newValue === "en" ? "en" : "ru";
      renderedKey = "";
      schedule();
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (!msg || typeof msg !== "object" || msg.type !== "GET_AE_SNAPSHOT") return;
    respond(snapshot() ?? unavailableSignal() ?? (blocked() ? { blocked: true } : null));
  });
})();
