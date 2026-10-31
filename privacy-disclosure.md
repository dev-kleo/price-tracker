# Privacy disclosures for v2.6 (shared price history)

This is a drafting aid, not legal advice. Check every statement against how your server really behaves, especially logging and retention.

## What the extension now sends

Only when the user has turned on "Делиться ценами" ("Share prices") (off by default; asked on the welcome page, once in the popup for existing users, and in Settings):

- `store`: one of `ozon`, `wb`, `ym`, `ali`
- `product_id`: the marketplace product id (for AliExpress `item-sku`)
- `price`: a whole number of rubles, the public price (not the Ozon card price, not the Yandex Pay price)

When: a product page is open, the price was parsed and the product is in stock; at most once per product per 6 hours per browser, or at once when the price changed. A second request reads the shared history of a product when its chart is opened (`store` and `product_id` only, cached 3 hours).

Not sent: user id, account, cookies (`credentials: "omit"`), referrer, page URLs, titles, images, the tracked list, folders, settings.

What the server unavoidably sees: the IP address and request time of every request. The policy states that the IP address is received but not stored.

## Chrome Web Store: Privacy practices tab

1. **Single purpose:** "Track prices of products on Ozon, Wildberries, Yandex Market and AliExpress, show price history and alert the user when a price drops."
2. **Permission justifications** (unchanged list: alarms, notifications, storage, scripting, offscreen; hosts: the four marketplaces). No new permission was added for the API, because it answers with open CORS. The justification for `storage` should now also say it stores the sharing choice and a small cache of shared history.
3. **Remote code:** No.
4. **Data collection:** tick **Web history**. Product ids of pages the user opens (only while sharing is on) are the closest category. Tick **Website content** only if you consider the price to be page content. If in doubt, tick both. Do not tick personally identifiable information, health, financial, authentication, personal communications, location or user activity data, unless you add logging that would qualify.
5. **Certify all three statements:** the data is not sold to third parties, not used or transferred for purposes unrelated to the single purpose, and not used for creditworthiness or lending.
6. **Privacy policy URL:** must be public and must contain the text below. The listing's "does not collect data" wording, if any, has to be removed.

## Privacy policy text to add (Russian)

> **Делиться ценами (по желанию).** По умолчанию расширение ничего не отправляет на наш сервер. Если вы включили «Делиться ценами» (на приветственной странице или в Настройках), расширение, когда вы открываете страницу товара Ozon, Wildberries, Яндекс Маркета или AliExpress, отправляет на сервер, которым управляет разработчик, три значения: магазин (ozon, wb, ym, ali), идентификатор товара и цену в рублях. Время записи добавляет сервер. Также расширение запрашивает с сервера историю цены этого товара для графика. Мы используем эти данные, чтобы показывать историю цен, собранную другими пользователями, и улучшать отслеживание цен. Мы не продаём их и не используем для рекламы.
>
> Расширение не отправляет ваш список товаров, адреса страниц, названия, аккаунт, имя, историю браузера, cookie и другие личные данные. Идентификатора пользователя нет. Сервер, как любой веб-сервис, получает IP-адрес и время каждого запроса, но не сохраняет IP-адрес. Данные хранятся в Yandex Cloud (YDB), Россия. Записи о ценах хранятся без ограничения срока, пока работает сервис; они не содержат личных данных.
>
> Вы можете отключить передачу в любой момент в Настройках (переключатель «Делиться ценами»). После отключения вся отправка прекращается. Отправленные ранее значения цен не содержат сведений о вас и не могут быть привязаны к вам, поэтому удалить их по отдельности нельзя. Разработчик: Abhishek Dey (независимый разработчик), deyintelligence.com. По вопросам о конфиденциальности: coding.cleo@gmail.com.

## Same text in English

> **Share prices (optional).** By default the extension sends nothing to our server. If you turn on "Share prices" (on the welcome page or in Settings), then when you open a product page on Ozon, Wildberries, Yandex Market or AliExpress, the extension sends three values to a server operated by the developer: the store (ozon, wb, ym, ali), the product identifier and the price in rubles. The server adds the time of the record. The extension also requests the shared price history of that product to draw the chart. We use this data to show price history collected from other users and to improve price tracking. We do not sell it and do not use it for advertising.
>
> The extension does not send your tracked list, page addresses, titles, account, name, browsing history, cookies or any other personal data. There is no user identifier. Like any web service the server receives the IP address and the time of each request, but it does not store the IP address. Data is stored in Yandex Cloud (YDB), Russia. Price records are kept without a time limit while the service runs; they contain no personal data.
>
> You can turn sharing off at any time in Settings (the "Share prices" switch). After that all sending stops. Prices shared earlier contain nothing about you and cannot be linked to you, so they cannot be deleted individually. Developer: Abhishek Dey (independent developer), deyintelligence.com. Privacy questions: coding.cleo@gmail.com.

## To keep in mind

- The logging, retention and contact lines are filled from the developer's facts (IP not stored; records kept without a time limit; contact coding.cleo@gmail.com). Re-check them if the server changes.
- Data quality: Ozon and Wildberries prices differ by region and delivery point. One shared series per product mixes them, and the API's 30%-300% guard only rejects extreme values. If this matters, consider region in a future API version.
