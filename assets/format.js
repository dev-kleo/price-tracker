// Formatting helpers. Every number the UI shows is formatted here from stored data.
let lang = "ru";
export const setLang = (l) => { lang = l === "en" ? "en" : "ru"; };
const locale = () => (lang === "en" ? "en-GB" : "ru-RU");

const rub = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
export const money = (v) => rub.format(Math.round(v));
export const minus = "−";

/** Signed percent from a fraction (-0.12 -> "−12%"). Small values keep one decimal; the decimal mark follows the language. */
export const pct = (fraction) => {
  const v = fraction * 100, a = Math.abs(v);
  if (a < 0.05) return "0%";
  const body = a < 10 ? a.toFixed(1) : String(Math.round(a));
  return `${v > 0 ? "+" : minus}${lang === "en" ? body : body.replace(".", ",")}%`;
};

export const dateShort = (ts) => new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short" }).format(ts);
export const dateLong = (ts) => new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short", year: "numeric" }).format(ts);
export const dateTime = (ts) => new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(ts);
export const minutesAgo = (ts) => Math.max(0, Math.floor((Date.now() - ts) / 60000));

/** Match highlighting: returns DOM nodes with the matching part wrapped in <mark>. */
export function highlight(text, needle) {
  const q = needle.trim().toLowerCase();
  if (!q) return [document.createTextNode(text)];
  const out = [], low = text.toLowerCase();
  let at = 0, i;
  while ((i = low.indexOf(q, at)) !== -1) {
    if (i > at) out.push(document.createTextNode(text.slice(at, i)));
    const m = document.createElement("mark"); m.textContent = text.slice(i, i + q.length); out.push(m);
    at = i + q.length;
  }
  if (at < text.length) out.push(document.createTextNode(text.slice(at)));
  return out;
}
