# Privacy disclosures for v2.6.0 (shared price history)

This is a drafting aid, not legal advice. Check every statement against how your server really behaves, especially logging and retention.

## What the extension now sends

Only when the user has turned on "Общая история цен" (off by default; asked on the welcome page, once in the popup for existing users, and in Settings):

- `store`: one of `ozon`, `wb`, `ym`, `ali`
- `product_id`: the marketplace product id (for AliExpress `item-sku`)
- `price`: a whole number of rubles, the public price (not the Ozon card price, not the Yandex Pay price)

When: a product page is open, the price was parsed and the product is in stock; at most once per product per 6 hours per browser, or at once when the price changed. A second request reads the shared history of a product when its chart is opened (`store` and `product_id` only, cached 3 hours).

Not sent: user id, account, cookies (`credentials: "omit"`), referrer, page URLs, titles, images, the tracked list, folders, settings.

What the server unavoidably sees: the IP address and request time of every request. State in the policy whether your function logs them, for how long, and that you do not link them to anything.

## Chrome Web Store: Privacy practices tab

1. **Single purpose:** "Track prices of products on Ozon, Wildberries, Yandex Market and AliExpress, show price history and alert the user when a price drops."
2. **Permission justifications** (unchanged list: alarms, notifications, storage, scripting, offscreen; hosts: the four marketplaces). No new permission was added for the API, because it answers with open CORS. The justification for `storage` should now also say it stores the sharing choice and a small cache of shared history.
3. **Remote code:** No.
4. **Data collection:** tick **Web history**. Product ids of pages the user opens (only while sharing is on) are the closest category. Tick **Website content** only if you consider the price to be page content. If in doubt, tick both. Do not tick personally identifiable information, health, financial, authentication, personal communications, location or user activity data, unless you add logging that would qualify.
5. **Certify all three statements:** the data is not sold to third parties, not used or transferred for purposes unrelated to the single purpose, and not used for creditworthiness or lending.
6. **Privacy policy URL:** must be public and must contain the text below. The listing's "does not collect data" wording, if any, has to be removed.

## Privacy policy text to add (Russian)

> **Общая история цен (по желанию).** По умолчанию расширение ничего не отправляет на наш сервер. Если вы включили «Общая история цен» (на приветственной странице или в Настройках), расширение, когда вы открываете страницу товара Ozon, Wildberries, Яндекс Маркета или AliExpress, отправляет на сервер, которым управляет разработчик, три значения: магазин, идентификатор товара и цену в рублях. Также оно запрашивает с сервера историю цены этого товара для графика. Мы используем эти данные только для построения общей истории цен. Мы не передаём их третьим лицам, не продаём и не используем для рекламы.
>
> Расширение не отправляет ваш список товаров, адреса страниц, названия, аккаунт, cookie и другие личные данные. Данные не связаны с конкретным пользователем: идентификатора пользователя нет. Сервер, как любой веб-сервис, получает IP-адрес и время запроса. [Укажите, ведётся ли журнал, как долго хранится и кто имеет доступ.] Данные о ценах хранятся [срок хранения].
>
> Вы можете отключить передачу в любой момент в Настройках. После отключения новые данные не отправляются. Отправленные ранее значения цен не содержат сведений о вас и не могут быть привязаны к вам, поэтому удалить их по вашему запросу нельзя. По вопросам: [контакт].

## Same text in English

> **Shared price history (optional).** By default the extension sends nothing to our server. If you turn on "Shared price history" (on the welcome page or in Settings), then when you open a product page on Ozon, Wildberries, Yandex Market or AliExpress, the extension sends three values to a server operated by the developer: the store, the product identifier and the price in rubles. It also requests the shared price history of that product to draw the chart. We use this data only to build a shared price history. We do not share it with third parties, sell it or use it for advertising.
>
> The extension does not send your tracked list, page addresses, titles, account, cookies or any other personal data. The data is not tied to a user: there is no user identifier. Like any web service the server receives the IP address and the time of a request. [State whether requests are logged, for how long and who has access.] Price data is kept for [retention period].
>
> You can turn sharing off at any time in Settings. After that no new data is sent. Prices sent earlier contain nothing about you and cannot be linked to you, so they cannot be deleted on request. Questions: [contact].

## Two things to settle before publishing

- Fill the bracketed lines (logging, retention, contact). They depend on your server.
- Data quality: Ozon and Wildberries prices differ by region and delivery point. One shared series per product mixes them, and the API's 30%-300% guard only rejects extreme values. If this matters, consider region in a future API version.
