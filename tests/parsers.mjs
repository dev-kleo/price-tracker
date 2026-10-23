// Availability detection by the REAL content scripts, running on saved pages. Only genuine sold-out / removed pages may report
// "unavailable"; an empty or failed page must report nothing (the background turns that into an error, never "unavailable").
import { launch, reporter, SITES } from "./lib.mjs";

const { check, finish } = reporter("parsers");
const env = await launch();

// expected: kind "snapshot" (valid price snapshot), "unavailable" (positive signal, reason), "none" (nothing to report)
const CASES = {
  ozon: {
    available: { kind: "snapshot", price: 1499, availability: "available" },
    "soldout-ld": { kind: "unavailable", reason: "out_of_stock" },
    "soldout-ld-withprice": { kind: "snapshot", availability: "unavailable" },
    "soldout-widget": { kind: "unavailable", reason: "out_of_stock" },
    "soldout-text": { kind: "unavailable", reason: "out_of_stock" },
    removed: { kind: "unavailable", reason: "removed" },
    failed: { kind: "none" },
  },
  wb: {
    available: { kind: "snapshot", price: 1024, availability: "available" },
    soldout: { kind: "unavailable", reason: "out_of_stock" },
    removed: { kind: "unavailable", reason: "removed" },
    failed: { kind: "none" },
  },
  ym: {
    available: { kind: "snapshot", price: 127, availability: "available" },
    "soldout-ld": { kind: "snapshot", availability: "unavailable" },
    "soldout-text": { kind: "unavailable", reason: "out_of_stock" },
    removed: { kind: "unavailable", reason: "removed" },
    failed: { kind: "none" },
  },
};

try {
  for (const [site, cases] of Object.entries(CASES)) {
    for (const [fixture, want] of Object.entries(cases)) {
      env.serving[site] = fixture;
      const page = await env.ctx.newPage();
      await page.goto(SITES[site].url, { waitUntil: "load" });
      const got = await env.snapshotOf(site);
      let ok, shown;
      if (want.kind === "snapshot") {
        ok = !!got?.price && (want.price === undefined || got.price.value === want.price) && got.availability === want.availability && got.ozonProductId === SITES[site].productId;
        shown = got && { id: got.ozonProductId, price: got.price?.value, availability: got.availability };
      } else if (want.kind === "unavailable") {
        ok = got?.unavailable === true && got.reason === want.reason && got.ozonProductId === SITES[site].productId && !got.price;
        shown = got;
      } else {
        ok = got === null || got === undefined;
        shown = got;
      }
      check(`${site}/${fixture}: ${want.kind}${want.reason ? ` (${want.reason})` : want.availability ? ` (${want.availability})` : ""}`, ok, shown);
      await page.close();
    }
  }
} finally {
  await env.close();
}
process.exit(finish() ? 1 : 0);
