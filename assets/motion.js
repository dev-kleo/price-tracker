// Motion: springs, press feedback, drag gestures, rubber-banding, sheets, popovers, toasts.
// Everything the user touches is animated from its CURRENT on-screen value and carries velocity, so any transition can be interrupted
// without a jump. Only transform and opacity are animated (the count-up is the one explicit exception). All timings are tokens.

const root = document.documentElement;
const token = (name, fallback) => { const v = parseFloat(getComputedStyle(root).getPropertyValue(name)); return Number.isFinite(v) ? v : fallback; };

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- spring ----
export class Spring {
  constructor(value = 0, { response = token("--spring-response", 0.35), damping = token("--spring-damping", 1), threshold = 0.001, onUpdate = () => {}, onRest = () => {} } = {}) {
    Object.assign(this, { x: value, v: 0, target: value, response, damping, threshold, onUpdate, onRest, raf: 0, last: 0 });
    this.tick = this.tick.bind(this);
  }
  /** Animate to `target` starting from the current value and velocity (or an explicit release velocity). */
  to(target, { velocity, damping } = {}) {
    this.target = target;
    if (velocity !== undefined) this.v = velocity;
    if (damping !== undefined) this.damping = damping;
    if (reduced()) { this.cancel(); this.x = target; this.v = 0; this.onUpdate(this.x); this.onRest(); return; }
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); }
  }
  /** Jump to a value (used while a finger/pointer drives the value 1:1). Keeps the target so release can continue from here. */
  set(x) { this.cancel(); this.x = x; this.target = x; this.v = 0; this.onUpdate(x); }
  cancel() { cancelAnimationFrame(this.raf); this.raf = 0; }
  get running() { return this.raf !== 0; }
  tick(now) {
    const dt = Math.min(0.064, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    const k = (2 * Math.PI / this.response) ** 2, c = 2 * this.damping * Math.sqrt(k);
    const steps = Math.ceil(dt / 0.004), h = dt / steps;
    for (let i = 0; i < steps; i++) { this.v += (k * (this.target - this.x) - c * this.v) * h; this.x += this.v * h; }
    this.onUpdate(this.x);
    if (Math.abs(this.target - this.x) < this.threshold && Math.abs(this.v) < this.threshold * 50) {
      this.raf = 0; this.x = this.target; this.v = 0; this.onUpdate(this.x); this.onRest();
    } else this.raf = requestAnimationFrame(this.tick);
  }
}

/** iOS-style resistance: moves less and less the further past `limit` you pull. */
export const rubber = (over, limit) => (over <= 0 ? 0 : (1 - 1 / ((over * 0.55) / limit + 1)) * limit);
/** Where a release at position `d` with velocity `v` (px/s) would come to rest: used to pick the snap target. */
export const project = (d, v) => d + v * 0.2;
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ----------------------------------------------------------- press feedback ----
/** Feedback on pointer-down (not click): `.pressed` is set within the same frame and released on pointer-up/cancel. */
export function pressFeedback(container) {
  container.addEventListener("pointerdown", (e) => {
    const t = e.target.closest?.("[data-press], button, .row, .seg-item, .tab");
    if (!t || t.disabled || t.closest("[data-nopress]")) return;
    t.classList.add("pressed");
    const off = () => { t.classList.remove("pressed"); window.removeEventListener("pointerup", off, true); window.removeEventListener("pointercancel", off, true); };
    window.addEventListener("pointerup", off, true);
    window.addEventListener("pointercancel", off, true);
  }, true);
}

// ------------------------------------------------------------------ drag ----
/**
 * Pointer-captured drag along one axis. Tracks the pointer 1:1 from the point where the drag committed (so there is no jump),
 * waits for ~10px of movement before choosing a direction, and reports release velocity for the spring.
 */
export function drag(el, { axis = "x", canStart, onStart, onMove, onEnd } = {}) {
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (canStart && !canStart(e)) return;
    const hysteresis = token("--drag-hysteresis", 10);
    const id = e.pointerId, from = { x: e.clientX, y: e.clientY };
    let active = false, origin = 0, samples = [], last = 0;
    const main = (p) => (axis === "x" ? p.x : p.y);
    const move = (ev) => {
      if (ev.pointerId !== id) return;
      const dx = ev.clientX - from.x, dy = ev.clientY - from.y;
      if (!active) {
        const along = Math.abs(axis === "x" ? dx : dy), across = Math.abs(axis === "x" ? dy : dx);
        if (along < hysteresis && across < hysteresis) return;
        if (across > along) { stop(); return; }           // the gesture belongs to the other axis (scrolling): let it go
        active = true; origin = main({ x: ev.clientX, y: ev.clientY });
        try { el.setPointerCapture(id); } catch { /* element may be gone */ }
        onStart?.(ev);
      }
      last = main({ x: ev.clientX, y: ev.clientY }) - origin;
      samples.push({ t: ev.timeStamp, d: last });
      while (samples.length > 2 && ev.timeStamp - samples[0].t > 90) samples.shift();
      onMove?.(last, ev);
    };
    const velocity = () => { if (samples.length < 2) return 0; const a = samples[0], b = samples.at(-1); return b.t === a.t ? 0 : ((b.d - a.d) / (b.t - a.t)) * 1000; };
    const up = (ev) => {
      if (ev.pointerId !== id) return;
      const wasActive = active, v = velocity();
      stop();
      if (wasActive) onEnd?.({ d: last, v, cancelled: ev.type === "pointercancel" });
    };
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); try { el.releasePointerCapture(id); } catch { /* already released */ } };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  });
}

/** Mouse-wheel elasticity at the ends of a scroll area (a trackpad/wheel stand-in for touch rubber-banding). */
export function elastic(scroll, content) {
  const limit = 64;
  let pull = 0, timer = 0;
  const sp = new Spring(0, { response: 0.4, threshold: 0.05, onUpdate: (v) => { content.style.transform = v ? `translate3d(0, ${v.toFixed(2)}px, 0)` : ""; } });
  scroll.addEventListener("wheel", (e) => {
    if (reduced()) return;
    const atTop = scroll.scrollTop <= 0, atBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1;
    if (!((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0))) { pull = 0; return; }
    e.preventDefault();
    pull = clamp(pull + Math.abs(e.deltaY) * 0.5, 0, limit * 3);
    sp.set((e.deltaY < 0 ? 1 : -1) * rubber(pull, limit));
    clearTimeout(timer);
    timer = setTimeout(() => { pull = 0; sp.to(0); }, 90);
  }, { passive: false });
}

// --------------------------------------------------------------- count-up ----
const counted = new Set();
/** Counts a number up once per key (first view). Reduced motion: shows the final value. */
export function countUp(el, to, format, key) {
  if (reduced() || (key && counted.has(key)) || !(to > 0)) { el.textContent = format(to); return; }
  if (key) counted.add(key);
  const dur = token("--t-count", 700), t0 = performance.now();
  const step = (now) => {
    const p = clamp((now - t0) / dur, 0, 1), eased = 1 - (1 - p) ** 3;
    el.textContent = format(Math.round(to * eased));
    if (p < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = format(to);
  };
  el.textContent = format(0);
  requestAnimationFrame(step);
}

// ------------------------------------------------------------- bottom sheet ----
let sheetOpen = null;
/**
 * Bottom sheet inside `layer`. Follows the pointer 1:1 when dragged down, rubber-bands when pulled up, and uses the release velocity
 * (projected) to decide whether to dismiss. Opening and closing are springs, so tapping the scrim mid-open reverses smoothly.
 */
export function openSheet(layer, { title, build, onClose, label }) {
  if (sheetOpen) sheetOpen.close(true);
  const previous = document.activeElement;
  const scrim = Object.assign(document.createElement("div"), { className: "scrim" });
  const sheet = Object.assign(document.createElement("div"), { className: "sheet" });
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", label ?? title);
  const grab = Object.assign(document.createElement("div"), { className: "sheet-grab" });
  grab.append(Object.assign(document.createElement("span"), { className: "sheet-handle" }));
  if (title) grab.append(Object.assign(document.createElement("div"), { className: "sheet-title", textContent: title }));
  const body = Object.assign(document.createElement("div"), { className: "sheet-body" });
  sheet.append(grab, body);
  layer.append(scrim, sheet);
  let closed = false;
  const close = (instant = false) => {
    if (closed) return; closed = true; sheetOpen = null;
    const done = () => { scrim.remove(); sheet.remove(); try { previous?.focus?.({ preventScroll: true }); } catch { /* ignore */ } onClose?.(); };
    if (instant) { sp.cancel(); done(); return; }
    sp.onRest = done; sp.to(height());
  };
  const height = () => sheet.offsetHeight || 1;
  const apply = (y) => { sheet.style.transform = `translate3d(0, ${y}px, 0)`; scrim.style.opacity = String(clamp(1 - y / height(), 0, 1)); };
  const sp = new Spring(0, { onUpdate: apply, threshold: 0.4 }); // pixels: settle within half a pixel
  let base = 0;
  build(body, close);
  sp.set(height()); // start fully below the edge, then spring up
  requestAnimationFrame(() => { sp.set(height()); sp.to(0); });
  scrim.addEventListener("pointerdown", () => close());
  const key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
  sheet.addEventListener("keydown", key);
  drag(sheet, {
    axis: "y",
    canStart: (e) => grab.contains(e.target) || body.scrollTop <= 0,
    onStart: () => { base = sp.x; sp.cancel(); },
    onMove: (d) => { const y = base + d; sp.set(y >= 0 ? y : -rubber(-y, 48)); },
    onEnd: ({ d, v }) => {
      const flick = Math.abs(v) > 600;
      const dismiss = project(Math.max(base + d, 0), v) > height() * 0.4 || (flick && v > 0);
      sp.onRest = dismiss ? () => close(true) : () => {};
      if (dismiss) { closed = true; sheetOpen = null; sp.onRest = () => { scrim.remove(); sheet.remove(); try { previous?.focus?.({ preventScroll: true }); } catch { /* ignore */ } onClose?.(); }; }
      sp.to(dismiss ? height() : 0, { velocity: v, damping: flick ? token("--spring-flick-damping", 0.78) : undefined });
    },
  });
  setTimeout(() => (body.querySelector("input, button, select, [tabindex]") ?? sheet).focus?.({ preventScroll: true }), 60);
  sheetOpen = { close, sheet, scrim, spring: sp };
  return sheetOpen;
}

// ----------------------------------------------------------------- popover ----
let popoverOpen = null;
/** Menu that grows out of its trigger (transform-origin = the trigger) and closes on outside press, Escape or choosing an item. */
export function openPopover(layer, trigger, build) {
  popoverOpen?.close(true);
  const pop = Object.assign(document.createElement("div"), { className: "popover" });
  pop.setAttribute("role", "menu");
  layer.append(pop);
  const close = (instant) => {
    if (!popoverOpen || popoverOpen.pop !== pop) return;
    popoverOpen = null;
    document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", key, true);
    const done = () => { pop.remove(); try { trigger.focus({ preventScroll: true }); } catch { /* ignore */ } };
    if (instant) { sp.cancel(); done(); } else { sp.onRest = done; sp.to(0); }
  };
  build(pop, close);
  const lb = layer.getBoundingClientRect(), tb = trigger.getBoundingClientRect();
  const right = lb.right - tb.right, top = tb.bottom - lb.top + 6;
  Object.assign(pop.style, { right: `${Math.max(8, right)}px`, top: `${top}px` });
  const pb = pop.getBoundingClientRect();
  pop.style.transformOrigin = `${clamp(tb.left + tb.width / 2 - pb.left, 0, pb.width)}px ${clamp(tb.top + tb.height / 2 - pb.top, -20, pb.height)}px`;
  const sp = new Spring(0, { response: 0.3, onUpdate: (t) => { pop.style.opacity = String(clamp(t, 0, 1)); pop.style.transform = `scale(${0.86 + 0.14 * clamp(t, 0, 1.04)})`; } });
  sp.set(0); sp.to(1);
  const outside = (e) => { if (!pop.contains(e.target) && !trigger.contains(e.target)) close(); };
  const key = (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", key, true);
  popoverOpen = { pop, close };
  setTimeout(() => pop.querySelector("button")?.focus({ preventScroll: true }), 40);
  return popoverOpen;
}
export const closePopover = () => popoverOpen?.close(true);

// ------------------------------------------------------------------- toast ----
let toastEl = null, toastTimer = 0;
/** One toast at a time, above the tab bar. An action ("Отменить") really restores what was removed; the timer pauses on hover. */
export function toast(layer, text, action) {
  toastEl?.remove(); clearTimeout(toastTimer);
  const el = Object.assign(document.createElement("div"), { className: "toast" });
  el.setAttribute("role", "status");
  const msg = Object.assign(document.createElement("span"), { className: "toast-text", textContent: text });
  el.append(msg);
  const dismiss = () => { if (toastEl !== el) return; toastEl = null; clearTimeout(toastTimer); sp.onRest = () => el.remove(); sp.to(1); };
  if (action) {
    const b = Object.assign(document.createElement("button"), { className: "toast-action", type: "button", textContent: action.label });
    b.addEventListener("click", async () => { dismiss(); await action.run(); });
    el.append(b);
  }
  layer.append(el);
  const sp = new Spring(1, { onUpdate: (t) => { el.style.transform = `translate3d(-50%, ${t * 140}%, 0)`; el.style.opacity = String(clamp(1 - t * 0.9, 0, 1)); } });
  toastEl = el;
  sp.set(1); sp.to(0);
  const arm = () => { clearTimeout(toastTimer); toastTimer = setTimeout(dismiss, token("--toast-ms", 6000)); };
  el.addEventListener("pointerenter", () => clearTimeout(toastTimer));
  el.addEventListener("pointerleave", arm);
  arm();
  return { dismiss };
}
