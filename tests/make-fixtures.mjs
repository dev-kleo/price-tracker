// Regenerates tests/fixtures/*. The generated .html files are what the tests read; this script only exists so they are easy to edit.
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "fixtures");
const write = (rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text.trimStart()); };
const page = (title, head, body) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title>${head}</head>\n<body>${body}</body></html>\n`;

write("README.md", `# Parser fixtures

Minimal saved pages for the availability tests. Playwright serves them at the real marketplace URLs, so the real content scripts run on them.

- wb/*    structure copied from LIVE Wildberries pages (observed 2026-10-23). Sold out = \`<h2 class="...soldOutProduct...">Нет в&nbsp;наличии</h2>\`
          in the product header with no price block. Removed = h1 "По Вашему запросу ничего не найдено" and no product header.
- ym/*    "removed" copied from LIVE Yandex Market (title "Нет такой страницы", text "Продавец удалил этот товар", HTTP 200).
          The sold-out pages are SYNTHETIC (schema.org OutOfStock, a "Нет в продаже" line): no live sold-out page was available.
- ozon/*  SYNTHETIC. Ozon served an anti-bot challenge, so no live page could be inspected. Built from the extension's parsing rules and
          Ozon's known webOutOfStock widget / schema.org markup.
- *failed* empty or skeleton DOM: must become an ERROR, never "unavailable".
- Every available/sold-out page also carries recommendation tiles that show OTHER products' prices and "Нет в наличии" inside links (the false-positive trap).
`);

// ------------------------------------------------------------------ Wildberries (real structure)
const wbHeader = (price) => `<div class="headerTop--a1a9f j-product-header"><div class="productHeader--Z4dVw"><h2 class="mo-typography mo-typography_variant_title3">Кружка для чая и кофе фарфор- Такса, 340 мл</h2></div>${price}`;
const wbTiles = `<section><h2>Похожие</h2><a href="/catalog/111111111/detail.aspx"><span>РАСПРОДАЖА</span><div>Нет в наличии</div><span>2 999 ₽</span><span>Другая кружка</span></a><a href="/catalog/222222222/detail.aspx"><div>Нет в&nbsp;наличии</div><span>1 500 ₽</span></a></section>`;
write("wb/available.html", page("Кружка для чая и кофе фарфор- Такса, 340 мл COZY HOME 1415895532 купить за 1 024 ₽ в интернет‑магазине Wildberries", "",
  `<main><div class="productPageContent--EAcc3">${wbHeader(`<div class="priceBlock--JPTEi priceBlockCommon--zy6gk"><h3 class="mo-typography priceBlockWalletPrice--Eq4oH">1 003 ₽</h3><h3 class="mo-typography priceBlockFinalPrice--B5CAH">1 024 ₽</h3></div><button>В корзину</button><button>Купить сейчас</button>`)}</div></div>${wbTiles}</main>`));
write("wb/soldout.html", page("Кружка для чая и кофе фарфор- Такса, 340 мл COZY HOME 1415895532 купить в интернет‑магазине Wildberries", "",
  `<main><div class="productPageContent--EAcc3">${wbHeader(`<div class="priceBlock--JPTEi priceBlockCommon--zy6gk"><h2 class="mo-typography mo-typography_variant_title2 soldOutProduct--CtIDk">Нет в&nbsp;наличии</h2></div><button>В избранное</button>`)}</div></div>
<section><h2>У других продавцов</h2><div>от 244 ₽</div></section><section><h2>Похожие</h2><a href="/catalog/111111111/detail.aspx"><span>1 440 ₽</span><span>545 ₽</span><span>Другой товар</span></a></section></main>`));
write("wb/removed.html", page("Интернет‑магазин Wildberries: широкий ассортимент товаров - скидки каждый день!", "",
  `<main><h1>По Вашему запросу ничего не найдено</h1><a href="/">Перейти в каталог</a><section><a href="/catalog/111111111/detail.aspx"><span>296 ₽</span><span>813 ₽</span><span>Фиксирующий гель для бровей</span></a><a href="/catalog/222222222/detail.aspx"><div>Нет в наличии</div><span>4 939 ₽</span></a></section></main>`));
write("wb/failed.html", page("Wildberries", "", `<div id="app"><main></main></div>`));

// ------------------------------------------------------------------ Yandex Market
const ymLd = (availability, price = 127) => `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", "@context": "https://schema.org", name: "Кружка керамическая для чая, 250 мл", image: "https://avatars.mds.yandex.net/get-mpic/5220030/x/orig", offers: { "@type": "Offer", availability: `https://schema.org/${availability}`, price, priceCurrency: "RUB", url: "https://market.yandex.ru/card/kruzhka-dlya-chaya/5090882755" } })}</script>`;
const ymTiles = `<section><h2>Похожие</h2><a href="/card/drugaya/111111111"><div>Нет в продаже</div><span data-auto="snippet-price-current"><span>219</span><span> ₽</span></span></a><a href="/card/tretya/222222222"><span data-auto="snippet-price-current"><span>140</span><span> ₽</span></span></a></section>`;
const ymH1 = `<h1 data-auto="productCardTitle">Кружка керамическая для чая, 250 мл</h1>`;
write("ym/available.html", page("Кружка керамическая для чая — купить на Яндекс Маркете", ymLd("InStock"),
  `<main>${ymH1}<div data-zone-name="price"><div><button type="button"><span data-auto="snippet-price-current"><span>127</span><span> ₽</span></span></button></div><div><span data-auto="snippet-price-old"><span>340</span><span> ₽</span></span><span>–63%</span></div></div><div><button data-auto="cartButton">В корзину</button></div>${ymTiles}</main>`));
write("ym/soldout-ld.html", page("Кружка керамическая для чая — купить на Яндекс Маркете", ymLd("OutOfStock", 133),
  `<main>${ymH1}<div data-zone-name="price"><div><span data-auto="snippet-price-current"><span>133</span><span> ₽</span></span></div></div>${ymTiles}</main>`));
write("ym/soldout-text.html", page("Кружка керамическая для чая — купить на Яндекс Маркете", "",
  `<main>${ymH1}<div data-zone-name="offer"><div>Нет в продаже</div><button>Узнать о поступлении</button></div>${ymTiles}</main>`));
write("ym/removed.html", page("Нет такой страницы - Яндекс Маркет", "",
  `<div id="app"><header>Яндекс Маркет</header><div><div>Назад</div><div>Продавец удалил этот товар</div><div>Но наверняка на Маркете есть похожие</div></div><section><a href="/card/drugaya/111111111"><span data-auto="snippet-price-current"><span>219</span><span> ₽</span></span></a></section></div>`));
write("ym/failed.html", page("Яндекс Маркет", "", `<div id="app"></div>`));

// ------------------------------------------------------------------ Ozon (synthetic)
const ozLd = (availability, price) => `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "Электрочайник стеклянный 1.7 л", image: "https://cdn1.ozone.ru/s3/x.jpg", offers: { "@type": "Offer", ...(price ? { price: String(price) } : {}), priceCurrency: "RUB", availability: `https://schema.org/${availability}` } })}</script>`;
const ozHead = `<link rel="canonical" href="https://www.ozon.ru/product/elektrochaynik-1234567/"><meta property="og:image" content="https://cdn1.ozone.ru/s3/x.jpg">`;
const ozTiles = `<div data-widget="skuShelfGoods"><a href="/product/drugoy-9999999/"><div>Нет в наличии</div><span>2 100 ₽</span></a><a href="/product/tretiy-8888888/"><span>1 250 ₽</span></a></div>`;
const ozT = "Электрочайник стеклянный 1.7 л купить на OZON";
const ozH1 = `<h1>Электрочайник стеклянный 1.7 л</h1>`;
write("ozon/available.html", page(ozT, ozHead + ozLd("InStock", 1499), `<main>${ozH1}<div data-widget="webPrice"><span>1 499 ₽</span></div><div data-widget="webAddToCart"><button>Добавить в корзину</button></div>${ozTiles}</main>`));
write("ozon/soldout-ld.html", page(ozT, ozHead + ozLd("OutOfStock"), `<main>${ozH1}${ozTiles}</main>`));
write("ozon/soldout-ld-withprice.html", page(ozT, ozHead + ozLd("OutOfStock", 1599), `<main>${ozH1}<div data-widget="webPrice"><span>1 599 ₽</span></div>${ozTiles}</main>`));
write("ozon/soldout-widget.html", page(ozT, ozHead, `<main>${ozH1}<div data-widget="webOutOfStock"><div>Этот товар закончился</div></div>${ozTiles}</main>`));
write("ozon/soldout-text.html", page(ozT, ozHead, `<main>${ozH1}<div><span>Товар закончился</span></div>${ozTiles}</main>`));
write("ozon/removed.html", page("OZON — страница не найдена", "", `<main><div><h2>Такой страницы не существует</h2><a href="/">На главную</a></div>${ozTiles}</main>`));
write("ozon/failed.html", page("OZON", "", `<div id="__ozon"></div>`));
console.log("fixtures written to", root);
