(function () {
  "use strict";
  if (window.__optYmLoaded) return;
  window.__optYmLoaded = true;

  const ROOT_ID = "ym-price-tracker-root";
  const PATH_RE = /^\/(?:card\/[^/]+|product--[^/]+)\/(\d{5,15})\/?$/i;
  const BLOCK_RE = /(captcha|капча|вы не робот|не робот)/i;

  const asNumber = (v) => {
    const n = typeof v === "string" ? Number(v.replace(/\s/g, "").replace(",", ".")) : v;
    return typeof n === "number" && Number.isFinite(n) && n > 1 && n < 1e8 ? Math.round(n) : null;
  };
  const parseRub = (text) => {
    const m = String(text ?? "").replace(/[  -​ ]/g, " ").match(/(\d{1,3}(?: \d{3})+|\d+)\s*₽/);
    return m ? asNumber(m[1].replace(/ /g, "")) : null;
  };

function parsePriceBlock(text) {
  const t = String(text).replace(/[\u00a0\u2000-\u200b\u202f]/g, " ").replace(/\s+/g, " ");
  const rub = /(\d{1,3}(?: \d{3})+|\d+) ?₽/;
  const toNum = (x) => Number(x.replace(/ /g, ""));
  const m1 = t.match(rub);
  if (!m1) return null;
  const cur = toNum(m1[1]);
  if (!(cur > 1 && cur < 1e8)) return null;
  const rest = t.slice(m1.index + m1[0].length, m1.index + m1[0].length + 160);
  const pay = rest.slice(0, 40).includes("Пэй");
  const m2 = rest.match(rub);
  const oldRaw = m2 ? toNum(m2[1]) : null;
  const old = oldRaw !== null && oldRaw > cur ? oldRaw : null;
  const pct = old !== null ? rest.slice(m2.index + m2[0].length, m2.index + m2[0].length + 40).match(/[−–-]\s?(\d{1,2}) ?%/)?.[1] : undefined;
  return { cur, pay, old, pct: pct ? Number(pct) : null };
}

  function parseLocation(url = location.href) {
    try {
      const u = new URL(url);
      if (u.hostname !== "market.yandex.ru") return null;
      const id = u.pathname.match(PATH_RE)?.[1];
      return id ? { id, canonical: `${u.origin}${u.pathname.replace(/\/$/, "")}` } : null;
    } catch {
      return null;
    }
  }

  function productLd() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const json = JSON.parse(s.textContent ?? "");
        const list = Array.isArray(json) ? json : json["@graph"] ?? [json];
        const hit = list.find((x) => x && x["@type"] === "Product");
        if (hit) return hit;
      } catch { /* ignore malformed block */ }
    }
    return null;
  }

  function snapshot() {
    const loc = parseLocation();
    if (!loc) return null;
    const ld = productLd();
    const offer = Array.isArray(ld?.offers) ? ld.offers[0] : ld?.offers;
    // JSON-LD comes from the first server render; on client-side navigation it can belong to the previous product.
    const ldFresh = !!offer && String(offer.url ?? "").includes(`/${loc.id}`);

    // What the shopper sees (e.g. the Yandex Pay price) wins over JSON-LD; JSON-LD is the fallback.
    const block = parsePriceBlock(document.querySelector('[data-zone-name="price"]')?.innerText ?? "");
    let price = block?.cur ?? (ldFresh ? asNumber(offer.price ?? offer.lowPrice) : null);
    if (price === null) {
      const el = document.querySelector('[data-zone-name="price"] [data-auto="snippet-price-current"]');
      price = parseRub(el?.textContent);
    }
    let promoCode = null;
    let promoPercent = null;
    for (const z of document.querySelectorAll('[data-zone-name="profit"][data-zone-data]')) {
      try {
        const data = JSON.parse(z.getAttribute("data-zone-data") ?? "{}");
        if (data.name === "promoCode" && /^[A-Za-z0-9_-]{3,30}$/.test(data.promocode ?? "")) {
          promoCode = data.promocode;
          const pct = (z.textContent ?? "").match(/[−–-]\s*(\d{1,2})\s*%/)?.[1];
          promoPercent = pct ? Number(pct) : null;
          break;
        }
      } catch { /* ignore malformed zone data */ }
    }
    const title = (document.querySelector('h1[data-auto="productCardTitle"]')?.textContent ?? document.querySelector("h1")?.textContent ?? (ldFresh ? ld.name : "") ?? "").trim();
    if (price === null || title.length < 2) return null;

    const img = ldFresh ? (Array.isArray(ld.image) ? ld.image[0] : ld.image) : document.querySelector('meta[property="og:image"]')?.content;
    const availabilityText = ldFresh ? String(offer.availability ?? "") : "";
    return {
      ozonProductId: `ym:${loc.id}`,
      title,
      url: loc.canonical,
      canonicalUrl: loc.canonical,
      imageUrl: typeof img === "string" && img.startsWith("https://") ? img : undefined,
      price: { value: price, source: block ? "ym-dom" : ldFresh ? "ym-json-ld" : "ym-dom", confidence: block ? 0.97 : 0.8 },
      regularPrice: block?.old ?? null,
      discountPercent: block?.pct ?? null,
      priceBadge: block?.pay ? "pay" : null,
      promoCode,
      promoPercent,
      availability: /OutOfStock|SoldOut|Discontinued/i.test(availabilityText) ? "unavailable" : "available",
    };
  }

  function blocked() {
    return !!parseLocation() && !document.querySelector("h1") && BLOCK_RE.test(`${document.title} ${(document.body?.innerText ?? "").slice(0, 600)}`);
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
      return;
    }
    const key0 = `${snap.ozonProductId}:${snap.price.value}`;
    if (key0 !== lastSentKey || Date.now() - lastSentAt > 3e5) {
      lastSentKey = key0;
      lastSentAt = Date.now();
      send({ type: "YM_OBSERVATION", snapshot: snap }).catch(() => {});
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
    btn.style.cssText = "border:0;border-radius:12px;padding:12px 16px;background:#fc0;color:#000;font-weight:700;box-shadow:0 4px 18px #0003;cursor:pointer";
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        if (tracked) await send({ type: "UNTRACK_PRODUCT", id: tracked.id });
        else await send({ type: "YM_TRACK", snapshot: snap });
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

  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void update(), 700);
  };

  // Single-page app: react to URL changes and to the title/price nodes appearing.
  new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true });
  window.addEventListener("popstate", schedule);

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
    if (!msg || typeof msg !== "object" || msg.type !== "GET_YM_SNAPSHOT") return;
    respond(snapshot() ?? (blocked() ? { blocked: true } : null));
  });
})();
