(function () {
  "use strict";
  if (window.__optWbLoaded) return;
  window.__optWbLoaded = true;

  const ROOT_ID = "wb-price-tracker-root";
  const ID_RE = /\/catalog\/(\d{5,15})\/detail\.aspx/i;
  const CART_RE = /(в корзину|купить сейчас|добавить в корзину)/i;
  const GONE_RE = /(нет в наличии|распродан|товар закончился)/i;
  const BLOCK_RE = /(captcha|капча|вы не робот|подозрительн)/i;

  const parseRub = (text) => {
    const m = String(text ?? "").replace(/[  -​ ]/g, " ").match(/(\d{1,3}(?: \d{3})+|\d+)\s*₽/);
    if (!m) return null;
    const n = Number(m[1].replace(/ /g, ""));
    return Number.isFinite(n) && n > 1 && n < 1e8 ? n : null;
  };
  const textOf = (sel) => document.querySelector(sel)?.textContent?.trim() ?? "";

  function productId(url = location.href) {
    try {
      const u = new URL(url);
      if (!/(^|\.)wildberries\.ru$/i.test(u.hostname)) return null;
      return u.pathname.match(ID_RE)?.[1] ?? null;
    } catch {
      return null;
    }
  }

  function readTitle(nm) {
    const fromHeader = textOf('[class*="productHeader"] h2') || textOf('[class*="productHeader"]');
    if (fromHeader.length > 1) return fromHeader;
    // "<name> <brand> <id> купить за … ₽ в интернет‑магазине Wildberries"
    const t = document.title.split(nm)[0].trim();
    return t.length > 1 ? t : "";
  }

  function readPrices() {
    // The page lists the WB Wallet price and the regular final price separately.
    const final = parseRub(textOf('[class*="priceBlockFinalPrice"]'));
    const wallet = parseRub(textOf('[class*="priceBlockWalletPrice"]'));
    let price = final;
    if (price === null) {
      const m = document.title.match(/купить за\s*([\d\s  ]+)₽/i);
      price = m ? parseRub(`${m[1]} ₽`) : null;
    }
    return { price, wallet: wallet !== null && price !== null && wallet < price ? wallet : undefined };
  }

  function readImage() {
    const img = Array.from(document.querySelectorAll("img")).map((i) => i.currentSrc || i.src).find((s) => /^(https?:)?\/\/[^/]+\/.*\/\d{5,15}\/images\//.test(s));
    if (!img) return undefined;
    return img.startsWith("//") ? `https:${img}` : img.startsWith("https://") ? img : undefined;
  }

  function snapshot() {
    const nm = productId();
    if (!nm) return null;
    const title = readTitle(nm);
    const { price, wallet } = readPrices();
    if (!title || price === null) return null;
    const scope = document.querySelector("main") ?? document.body;
    const text = scope.innerText ?? "";
    const hasCart = Array.from(scope.querySelectorAll("button")).some((b) => CART_RE.test(b.textContent ?? ""));
    return {
      ozonProductId: `wb:${nm}`,
      title,
      url: `https://www.wildberries.ru/catalog/${nm}/detail.aspx`,
      canonicalUrl: `https://www.wildberries.ru/catalog/${nm}/detail.aspx`,
      imageUrl: readImage(),
      price: { value: price, source: "wb-dom", confidence: 0.9 },
      walletPrice: wallet,
      availability: !hasCart && GONE_RE.test(text) ? "unavailable" : "available",
    };
  }

  function blocked() {
    return !productId() ? false : !textOf('[class*="productHeader"]') && BLOCK_RE.test(`${document.title} ${(document.body?.innerText ?? "").slice(0, 600)}`);
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
      send({ type: "WB_OBSERVATION", snapshot: snap }).catch(() => {});
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
    btn.style.cssText = "border:0;border-radius:12px;padding:12px 16px;background:#a73afd;color:#fff;font-weight:700;box-shadow:0 4px 18px #0003;cursor:pointer";
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        if (tracked) await send({ type: "UNTRACK_PRODUCT", id: tracked.id });
        else await send({ type: "WB_TRACK", snapshot: snap });
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
    timer = window.setTimeout(() => void update(), 600);
  };

  // The page is a single-page app: react to URL changes and to price/title nodes appearing.
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) lastUrl = location.href;
    schedule();
  }).observe(document.documentElement, { subtree: true, childList: true });
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
    if (!msg || typeof msg !== "object" || msg.type !== "GET_WB_SNAPSHOT") return;
    respond(snapshot() ?? (blocked() ? { blocked: true } : null));
  });
})();
