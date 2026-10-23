# Changelog

## 2.4.0
- Unavailable products: sold-out or removed products are now marked "Нет в наличии" instead of showing the last price as if it were current.
  Detected per marketplace (Ozon, Wildberries, Yandex Market) from explicit signals only and confirmed on 2 consecutive checks; page-load or parser
  failures become a separate error state. No fake price points are added. The last price is greyed with the date it was last seen; charts draw a
  dashed grey line that stops at the last real price. Automatic filters "Недоступные" and "Ошибки" sit next to the user's folders (products are never
  moved out of folders). Unavailable products are re-checked about daily and return to normal tracking automatically when the price reappears.
- Group chart: quick filter by name or ID, "select/deselect matching", "only matching", "only selected", × to clear. Groups of more than 10 products open
  with the first 8 lines selected; the last selection is remembered per folder. Filtering only redraws the legend (debounced), not the chart.
- Fullscreen button on single-product and group charts (Esc to exit); the chart is redrawn at the screen size and the filter panel stays usable.
  The toolbar popup cannot go fullscreen, so there the button opens the same chart in a browser tab.
- Fix: Ozon availability is no longer guessed from the whole page text (it matched recommendation tiles).
