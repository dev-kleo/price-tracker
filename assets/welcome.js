import { STR } from "./i18n.js";

const SAMPLE = "https://www.wildberries.ru/catalog/1415895532/detail.aspx";
const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls ?? "", textContent: text ?? "" });

const { language } = await chrome.storage.sync.get({ language: "ru" }).catch(() => ({ language: "ru" }));
const lang = language === "en" ? "en" : "ru", t = STR[lang];
document.documentElement.lang = lang;

const root = document.getElementById("root"), wrap = el("div", "wrap");
const steps = el("ol", "steps");
[t.welcome1, t.welcome2, t.welcome3].forEach((s, i) => { const li = el("li"); li.append(el("span", "num", String(i + 1)), el("span", "", s)); steps.append(li); });
const stores = el("div", "stores");
[["ozon", "Ozon"], ["wb", "WB"], ["ym", "YM"], ["ae", "AE"]].forEach(([c, n]) => stores.append(Object.assign(el("span", `chip ${c}`, n), { title: n })));

// Opt-in: nothing is sent until this switch is on. Off by default; it can be changed later in Settings.
const input = Object.assign(document.createElement("input"), { type: "checkbox", id: "share" });
input.setAttribute("role", "switch");
input.addEventListener("change", () => chrome.storage.sync.set({ sharedHistory: input.checked }));
const knob = el("span", "track"); knob.append(el("span", "knob"));
const sw = el("span", "switch"); sw.append(input, knob);
const row = Object.assign(el("label", "switch-row"), { htmlFor: "share" }); row.append(el("span", "", t.sharedSwitch), sw);
const share = el("section", "card share"); share.append(el("h2", "", t.sharedTitle), el("p", "", t.sharedText), row, el("p", "", t.sharedHint));

const actions = el("div", "actions");
const sample = Object.assign(el("a", "pill primary", t.welcomeSample), { href: SAMPLE, target: "_blank", rel: "noopener noreferrer" });
const skip = Object.assign(el("button", "pill tint", t.welcomeSkip), { type: "button" });
skip.addEventListener("click", async () => { await chrome.storage.sync.set({ sharedHistory: input.checked }); window.close(); });
actions.append(sample, skip);

const card = el("section", "card"); card.append(steps);
wrap.append(el("h1", "", t.welcomeTitle), el("p", "lead", t.welcomeLead), card, stores, share, actions, el("p", "note", t.welcomeAeNote));
root.append(wrap);
document.title = t.welcomeTitle;
