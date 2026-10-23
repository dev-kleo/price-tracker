# Parser fixtures

Minimal saved pages for the availability tests. Playwright serves them at the real marketplace URLs, so the real content scripts run on them.

- wb/*    structure copied from LIVE Wildberries pages (observed 2026-10-23). Sold out = `<h2 class="...soldOutProduct...">Нет в&nbsp;наличии</h2>`
          in the product header with no price block. Removed = h1 "По Вашему запросу ничего не найдено" and no product header.
- ym/*    "removed" copied from LIVE Yandex Market (title "Нет такой страницы", text "Продавец удалил этот товар", HTTP 200).
          The sold-out pages are SYNTHETIC (schema.org OutOfStock, a "Нет в продаже" line): no live sold-out page was available.
- ozon/*  SYNTHETIC. Ozon served an anti-bot challenge, so no live page could be inspected. Built from the extension's parsing rules and
          Ozon's known webOutOfStock widget / schema.org markup.
- *failed* empty or skeleton DOM: must become an ERROR, never "unavailable".
- Every available/sold-out page also carries recommendation tiles that show OTHER products' prices and "Нет в наличии" inside links (the false-positive trap).
