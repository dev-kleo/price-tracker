// Small UI building blocks shared by every screen.
import { Spring } from "./motion.js";

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== "list" && k !== "style") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid !== undefined && kid !== null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

/** Inline icons (stroke = currentColor, so they follow the tokens). */
const ICONS = {
  more: '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/>',
  expand: '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
  shrink: '<path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8-9-9z"/><circle cx="7.5" cy="8.5" r="1"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
};
export const icon = (name, cls = "icon") => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", cls); s.setAttribute("aria-hidden", "true"); s.innerHTML = ICONS[name] ?? "";
  return s;
};

/** Round icon button; `label` is mandatory because the button has no text. */
export const roundButton = (name, label, onclick, cls = "") => h("button", { class: `round ${cls}`.trim(), type: "button", "aria-label": label, title: label, onclick }, icon(name));

/**
 * Segmented control: equal-width segments, a white thumb that slides between them on a spring (transform only), counts per segment.
 * The element persists while the list below it re-renders, so the thumb can be interrupted mid-slide and carries its velocity.
 */
export function segmented({ items, value, label, onChange }) {
  const n = items.length;
  const thumb = h("span", { class: "seg-thumb", "aria-hidden": "true" });
  const buttons = items.map((it, i) => {
    const count = it.count === undefined ? null : h("span", { class: "seg-count num" }, String(it.count));
    return h("button", { class: "seg-item", type: "button", role: "tab", dataset: { id: it.id }, "aria-selected": String(it.id === value), tabIndex: it.id === value ? 0 : -1, onclick: () => select(i, true) }, h("span", { class: "seg-text" }, it.text), count);
  });
  const el = h("div", { class: "seg", role: "tablist", "aria-label": label, style: undefined }, thumb, buttons);
  el.style.setProperty("--n", String(n));
  let index = Math.max(0, items.findIndex((it) => it.id === value));
  const sp = new Spring(index, { response: 0.32, threshold: 0.002, onUpdate: (v) => { thumb.style.transform = `translate3d(${(v * 100).toFixed(3)}%, 0, 0)`; } });
  sp.set(index);
  function select(i, user) {
    if (i < 0 || i >= n) return;
    index = i;
    buttons.forEach((b, j) => { b.setAttribute("aria-selected", String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    sp.to(i);
    if (user) onChange?.(items[i].id);
  }
  el.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault(); const i = Math.max(0, Math.min(n - 1, index + d)); select(i, true); buttons[i].focus();
  });
  return {
    el,
    setCounts(counts) { buttons.forEach((b, i) => { const c = b.querySelector(".seg-count"); if (c && counts[items[i].id] !== undefined) c.textContent = String(counts[items[i].id]); }); },
    setValue(id) { select(Math.max(0, items.findIndex((it) => it.id === id)), false); },
  };
}

/** iOS-style switch row inside an inset list. */
export function switchRow(label, checked, onChange, hint) {
  const input = h("input", { type: "checkbox", role: "switch", checked: !!checked, onchange: (e) => onChange(e.target.checked) });
  return h("label", { class: "row row-field" }, h("span", { class: "row-main" }, h("span", { class: "row-title" }, label), hint ? h("span", { class: "row-cap" }, hint) : null), h("span", { class: "switch" }, input, h("span", { class: "switch-track" }, h("span", { class: "switch-knob" }))));
}

/** Label + number input row. */
export function numberRow(label, value, { min = 0, max = 1e6, step = 1, onChange, suffix }) {
  const input = h("input", { class: "num-input num", type: "number", min: String(min), max: String(max), step: String(step), value: String(value), "aria-label": label,
    onchange: (e) => { const v = Math.min(max, Math.max(min, Math.round(Number(e.target.value)) || min)); e.target.value = String(v); onChange(v); } });
  return h("label", { class: "row row-field" }, h("span", { class: "row-main" }, h("span", { class: "row-title" }, label)), h("span", { class: "row-end" }, input, suffix ? h("span", { class: "row-cap" }, suffix) : null));
}

/** Inset grouped list: rows separated by hairlines that start after the leading image/label. */
export const group = (...rows) => h("div", { class: "group" }, rows);
export const sectionTitle = (text) => h("h2", { class: "section-title" }, text);

/** Empty state: one sentence and one action. */
export const emptyState = (text, actionLabel, onAction) => h("div", { class: "empty" }, h("p", { class: "empty-text" }, text), actionLabel ? h("button", { class: "pill tint", type: "button", onclick: onAction }, actionLabel) : null);

/** Placeholder rows shown while data loads (no spinners). */
export const skeletonRows = (count = 6) => h("div", { class: "group skeleton", "aria-hidden": "true" }, Array.from({ length: count }, () => h("div", { class: "row" },
  h("span", { class: "thumb sk" }), h("span", { class: "row-main" }, h("span", { class: "sk sk-line" }), h("span", { class: "sk sk-line short" })), h("span", { class: "sk sk-price" }))));
