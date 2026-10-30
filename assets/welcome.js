import { STR } from "./i18n.js";

const SAMPLE = "https://www.wildberries.ru/catalog/1415895532/detail.aspx";
const KEY = "sharedHistory"; // the same setting the popup's Settings screen uses
const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls ?? "", textContent: text ?? "" });
const btn = (cls, text, onclick) => { const b = Object.assign(el("button", cls, text), { type: "button" }); b.addEventListener("click", onclick); return b; };

const { language } = await chrome.storage.sync.get({ language: "ru" }).catch(() => ({ language: "ru" }));
const lang = language === "en" ? "en" : "ru", t = STR[lang];
document.documentElement.lang = lang;
document.title = t.welcomeTitle;

/* ---- sharing switch (page 2). Off unless the stored setting says otherwise; nothing is sent or read until it is on. ---- */
const input = Object.assign(document.createElement("input"), { type: "checkbox", id: "share" });
input.setAttribute("role", "switch");
const stored = await chrome.storage.sync.get(KEY).catch(() => ({}));
input.checked = stored[KEY] === true;
input.addEventListener("change", () => chrome.storage.sync.set({ [KEY]: input.checked }));
// stays in step with the Settings screen (and any other open window)
chrome.storage.onChanged.addListener((changes, area) => { if (area === "sync" && changes[KEY]) input.checked = changes[KEY].newValue === true; });

const track = el("span", "track"); track.append(el("span", "knob"));
const sw = el("span", "switch"); sw.append(input, track);
const row = Object.assign(el("label", "switch-row"), { htmlFor: "share" }); row.append(el("span", "", t.welcomeShare), sw);

/* ---- page 1: three steps ---- */
const steps = el("ol", "steps");
[t.welcome1, t.welcome2, t.welcome3].forEach((s, i) => { const li = el("li"); li.append(el("span", "num", String(i + 1)), el("span", "", s)); steps.append(li); });
const stores = el("div", "stores");
[["ozon", "Ozon"], ["wb", "WB"], ["ym", "YM"], ["ae", "AE"]].forEach(([c, n]) => stores.append(Object.assign(el("span", `chip ${c}`, n), { title: n })));
const card1 = el("section", "card"); card1.append(steps);

/* onboarding video: purely decorative, so a missing or unplayable file just removes it and the page works as before */
const video = Object.assign(document.createElement("video"), { className: "intro-video", src: "assets/price-tracker-onboarding.mp4", poster: "assets/price-tracker-poster.jpg", autoplay: true, muted: true, loop: true, playsInline: true, preload: "auto" });
video.setAttribute("muted", ""); video.setAttribute("aria-hidden", "true"); video.tabIndex = -1;
video.addEventListener("error", () => video.remove());

const finish = async () => { await chrome.storage.sync.set({ [KEY]: input.checked }); window.close(); }; // same for «Пропустить» and «Готово»
const sample = Object.assign(el("a", "pill tint", t.welcomeSample), { href: SAMPLE, target: "_blank", rel: "noopener noreferrer" });
const h1a = Object.assign(el("h1", "", t.welcomeTitle), { tabIndex: -1 });
const page1 = el("div", "page");
page1.append(h1a, el("p", "lead", t.welcomeLead), video, card1, stores,
  (() => { const a = el("div", "actions"); a.append(btn("pill primary", t.welcomeNext, () => show(2)), sample, btn("pill tint skip", t.welcomeSkip, finish)); return a; })(),
  el("p", "note", t.welcomeAeNote));

/* ---- page 2: price history and sharing ---- */
const h1b = Object.assign(el("h1", "", t.welcomeHistoryTitle), { tabIndex: -1 });
const text = el("section", "card text");
[t.welcomeH1, t.welcomeH2, t.welcomeH3].forEach((s) => text.append(el("p", "", s)));
const share = el("section", "card share"); share.append(row);
const page2 = el("div", "page");
page2.hidden = true;
page2.append(h1b, text, share,
  (() => { const a = el("div", "actions"); a.append(btn("pill tint back", t.welcomeBack, () => show(1)), btn("pill primary done", t.welcomeDone, finish), btn("pill tint skip", t.welcomeSkip, finish)); return a; })());

/* ---- shell: page indicator (1 / 2) ---- */
const indicator = Object.assign(el("p", "indicator"), { ariaLive: "polite" });
const pages = [page1, page2], heads = [h1a, h1b];
function show(n) {
  pages.forEach((p, i) => { p.hidden = i !== n - 1; });
  indicator.textContent = `${n} / 2`;
  heads[n - 1].focus({ preventScroll: true });
}
const wrap = el("div", "wrap");
wrap.append(indicator, page1, page2);
document.getElementById("root").append(wrap);
indicator.textContent = "1 / 2";
