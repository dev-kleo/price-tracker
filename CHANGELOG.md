# Changelog

## 2.5.0
- Новый интерфейс: спокойный, точный и быстрый. Крупный заголовок «Товары», карточка «Сэкономили за 30 дней» (считается по сохранённой истории, скрыта при нулевой экономии), переключатель «Все / Снизились / Нет в наличии / Ошибки» со счётчиками, единый список с изображениями, плавающая панель вкладок «Товары / Папки / Уведомления».
- Экран товара: крупная цена, прежняя цена, «Вы экономите», «Максимум за 90 дней», плашка «Минимум за 60 дней» только когда это правда; график 30 / 90 / Всё с пунктирной линией минимума, маркером текущей цены и точным значением под курсором; «Уведомить, если ниже …» действительно задаёт целевую цену.
- График группы: поиск, «Найдено K из N», «Выбрать / Снять найденные», «Только найденные / Только выбранные», недоступные товары пунктиром, «На весь экран».
- Движение: пружинные переходы, которые можно прервать без рывков; свайп назад; шторки тянутся за пальцем и мышью; упругие края; «Отменить» после удаления действительно возвращает товар или папку вместе с историей.
- Тёмная тема по системе или вручную (Настройки → Оформление); поддержка «уменьшить движение», «уменьшить прозрачность» и «повышенная контрастность».
- Все цвета, размеры и тайминги вынесены в один файл токенов; шрифт Inter входит в пакет (без загрузки из сети). Новые разрешения не нужны.

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
