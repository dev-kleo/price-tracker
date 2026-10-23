// SVG line charts for the product screen and the group screen. Colors, strokes and gutters come from CSS tokens
// (classes + custom properties); nothing here hard-codes a color.
import { reduced } from "./motion.js";

const NS = "http://www.w3.org/2000/svg";
const svgEl = (name, attrs = {}, text) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
};
const px = (host, name, fallback) => { const v = parseFloat(getComputedStyle(host).getPropertyValue(name)); return Number.isFinite(v) ? v : fallback; };
let uid = 0;
const drawn = new Set(); // lines draw in once per key (first view)

/**
 * spec: {
 *   series: [{ id, name, color: "var(--chart-1)", dashed, gone, dim, pts: [{ t, v, price }] }],
 *   yFormat(v), xFormat(t), ref?: { v, label }, zero?: boolean, marker?: boolean,
 *   animateKey?: string, ariaLabel, tip(point, series) -> string[], height?: number
 * }
 * Redraws itself when the host's width changes. Returns { destroy }.
 */
export function renderChart(host, spec) {
  host.__chart?.destroy();
  host.replaceChildren();
  host.classList.add("chart-host");
  const tip = Object.assign(document.createElement("div"), { className: "chart-tip" });
  tip.hidden = true;
  host.append(tip);
  let svg = null, ro = null, alive = true, lastW = 0, lastH = 0;

  const draw = () => {
    svg?.remove();
    const gutter = px(host, "--chart-gutter", 52), padT = px(host, "--chart-pad-top", 12), padB = px(host, "--chart-pad-bottom", 24), padL = px(host, "--chart-pad-left", 8);
    const W = Math.max(160, host.clientWidth || 360), H = Math.max(120, spec.height ?? (host.clientHeight || px(host, "--chart-h", 192)));
    lastW = W; lastH = H;
    const all = spec.series.flatMap((s) => s.pts);
    if (!all.length) return;
    const minT = Math.min(...all.map((p) => p.t)), maxT = Math.max(...all.map((p) => p.t));
    let lo = Math.min(...all.map((p) => p.v)), hi = Math.max(...all.map((p) => p.v));
    if (spec.ref) { lo = Math.min(lo, spec.ref.v); hi = Math.max(hi, spec.ref.v); }
    if (spec.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    // a flat line still gets a sensible axis
    const pad = (hi - lo) * 0.08 || Math.max(1, Math.abs(hi) * 0.05); lo -= pad; hi += pad;
    const x = (t) => padL + ((t - minT) / (maxT - minT || 1)) * (W - gutter - padL);
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

    svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": spec.ariaLabel ?? "" });
    svg.classList.add("chart");
    // light gridlines with value labels in the right gutter
    for (let i = 0; i <= 2; i++) {
      const v = lo + ((hi - lo) * i) / 2, gy = y(v);
      svg.append(svgEl("line", { class: "grid", x1: padL, x2: W - gutter, y1: gy, y2: gy }));
      svg.append(svgEl("text", { class: "axis", x: W - gutter + 8, y: gy + 4 }, spec.yFormat(v)));
    }
    svg.append(svgEl("text", { class: "axis", x: padL, y: H - 6 }, spec.xFormat(minT)));
    svg.append(svgEl("text", { class: "axis", x: (padL + W - gutter) / 2, y: H - 6, "text-anchor": "middle" }, spec.xFormat((minT + maxT) / 2)));
    svg.append(svgEl("text", { class: "axis", x: W - gutter, y: H - 6, "text-anchor": "end" }, spec.xFormat(maxT)));
    if (spec.zero) svg.append(svgEl("line", { class: "ref", x1: padL, x2: W - gutter, y1: y(0), y2: y(0) }));
    if (spec.ref) {
      svg.append(svgEl("line", { class: "ref", x1: padL, x2: W - gutter, y1: y(spec.ref.v), y2: y(spec.ref.v) }));
      svg.append(svgEl("text", { class: "ref-label", x: padL + 2, y: y(spec.ref.v) - 6 }, spec.ref.label));
    }

    // lines inside a clip so they can draw in from the left (transform only)
    const clipId = `clip-${++uid}`;
    const clipRect = svgEl("rect", { x: 0, y: 0, width: W, height: H });
    svg.append(svgEl("clipPath", { id: clipId }, undefined));
    svg.lastChild.append(clipRect);
    const lines = svgEl("g", { "clip-path": `url(#${clipId})` });
    for (const s of spec.series) {
      if (s.pts.length < 1) continue;
      const cls = ["line", s.dashed || s.gone ? "dashed" : "", s.dim ? "dim" : ""].filter(Boolean).join(" ");
      const style = `stroke:${s.gone ? "var(--chart-gone)" : s.color}`;
      if (s.pts.length === 1) lines.append(svgEl("circle", { class: "dot", cx: x(s.pts[0].t), cy: y(s.pts[0].v), style: `fill:${s.gone ? "var(--chart-gone)" : s.color}` }));
      else lines.append(svgEl("polyline", { class: cls, style, points: s.pts.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ") }));
    }
    svg.append(lines);
    if (spec.animateKey && !drawn.has(spec.animateKey) && !reduced()) {
      drawn.add(spec.animateKey);
      clipRect.style.transformBox = "fill-box"; clipRect.style.transformOrigin = "left center";
      clipRect.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: px(host, "--t-draw", 700), easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" });
    }
    if (spec.marker) {
      for (const s of spec.series) { const p = s.pts.at(-1); if (p && !s.dim) svg.append(svgEl("circle", { class: "marker", cx: x(p.t), cy: y(p.v), style: `fill:${s.gone ? "var(--chart-gone)" : s.color}` })); }
    }
    // scrub: follow the pointer, show the exact date and price of the nearest point
    const guide = svgEl("line", { class: "guide", y1: padT, y2: H - padB }); guide.style.display = "none";
    const dot = svgEl("circle", { class: "scrub-dot" }); dot.style.display = "none";
    svg.append(guide, dot);
    const hide = () => { guide.style.display = "none"; dot.style.display = "none"; tip.hidden = true; };
    const scrub = (e) => {
      const r = svg.getBoundingClientRect(), mx = ((e.clientX - r.left) / r.width) * W, my = ((e.clientY - r.top) / r.height) * H;
      let best = null, bd = Infinity;
      for (const s of spec.series) {
        if (s.dim) continue;
        for (const p of s.pts) { const d = Math.abs(x(p.t) - mx) + Math.abs(y(p.v) - my) * 0.25; if (d < bd) { bd = d; best = { p, s }; } }
      }
      if (!best || mx > W - gutter + 4) { hide(); return; }
      const cx = x(best.p.t), cy = y(best.p.v);
      guide.setAttribute("x1", cx); guide.setAttribute("x2", cx); guide.style.display = "";
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.style.display = ""; dot.style.fill = best.s.gone ? "var(--chart-gone)" : best.s.color;
      tip.replaceChildren(...spec.tip(best.p, best.s).map((line, i) => Object.assign(document.createElement("div"), { className: i ? "tip-sub" : "tip-main", textContent: line })));
      tip.hidden = false;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      const left = Math.min(Math.max(cx - tw / 2, 0), W - tw), top = Math.max(cy - th - 12, 0);
      tip.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    };
    svg.addEventListener("pointermove", scrub);
    svg.addEventListener("pointerdown", scrub);
    svg.addEventListener("pointerleave", hide);
    host.append(svg);
  };

  draw();
  ro = new ResizeObserver(() => { if (alive && (Math.abs(host.clientWidth - lastW) > 1 || (spec.fill && Math.abs(host.clientHeight - lastH) > 1))) draw(); });
  ro.observe(host);
  host.__chart = { destroy: () => { alive = false; ro?.disconnect(); } };
  return host.__chart;
}
