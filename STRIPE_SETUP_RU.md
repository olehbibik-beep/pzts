# Подключение Stripe для UPDATE PRO

Реализация находится в `functions`. Настройки Stripe и публикация в вашем Firebase ещё не выполнены. Выбрана готовая страница [Stripe Checkout](https://docs.stripe.com/payments/checkout): пользователь оплачивает там, Firebase подтверждает платёж и выдаёт PRO.

## 1. Подготовка

Включите Google и Email/Password в Firebase Authentication. Для публикации функций нужен тариф Firebase **Blaze**: [инструкция Firebase](https://firebase.google.com/docs/functions/get-started). Тариф и настройки списаний в этой задаче не менялись.

Начните с отдельного тестового Firebase-проекта и тестового режима Stripe. Укажите тестовый Firebase в `config.js`, а в командах ниже замените `pztsepscctv` на ID тестового проекта. Так тестовые покупки не выдадут PRO в рабочей базе. После проверки повторите настройку с рабочими ключами и ценами.

## 2. Цены Stripe

Создайте два продукта с ценой **One time / EUR**:

| Продукт | Цена | Тип |
| --- | --- | --- |
| PZTS PRO | 39,00 EUR | Разовая |
| PRO Suite — PZTS, EPS, CCTV, SK | 99,00 EUR | Разовая |

Скопируйте два `price_...` ID. Сервер проверяет точные суммы 3900/9900 евроцентов, валюту EUR и отсутствие подписки. Дополнительные налоги, сборы и скидки код не включает. Изменение итоговой суммы потребует изменения проверок в `billing-core.cjs`.

Скопируйте шаблон:

```powershell
Copy-Item functions/.env.example functions/.env.pztsepscctv
```

Заполните локальный `functions/.env.pztsepscctv`:

```dotenv
APP_ORIGIN=https://pzts.five.surf
STRIPE_SINGLE_PRICE_ID=price_ВАША_ЦЕНА_39
STRIPE_SUITE_PRICE_ID=price_ВАША_ЦЕНА_99
```

Для тестового проекта файл называется `.env.ID_ТЕСТОВОГО_ПРОЕКТА`, APP_ORIGIN — HTTPS-адрес тестового сайта. Сайт размещается в корне домена. Цены и секретный Stripe-ключ должны принадлежать одному режиму.

## 3. Webhook и секреты

В Stripe Workbench → Webhooks создайте **Snapshot** endpoint:

```text
https://europe-west1-pztsepscctv.cloudfunctions.net/stripeProWebhook
```

Для тестового проекта замените ID. Выберите события:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`

До публикации функция ещё не отвечает. Скопируйте signing secret `whsec_...`. [Настройка Stripe webhooks](https://docs.stripe.com/webhooks).

Из корня проекта выполните команды; значения вводите в запросе CLI:

```powershell
firebase login
firebase functions:secrets:set STRIPE_SECRET_KEY --project pztsepscctv
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project pztsepscctv
```

Первый секрет — серверный `sk_...`, второй — `whsec_...` этого endpoint. Не отправляйте их в чат и не публикуйте в GitHub. Они сохраняются в [Firebase Secret Manager](https://firebase.google.com/docs/functions/config-env). После смены секрета повторно опубликуйте функции.

## 4. Публикация

Используйте Node.js 22 и Firebase CLI. Из корня:

```powershell
npm --prefix functions ci
firebase deploy --project pztsepscctv --only "functions:pro-billing,firestore:rules,storage"
```

Публикуются `createProCheckout`, `confirmProCheckout`, `stripeProWebhook` в `europe-west1`. CLI может запросить включение API и разрешений. При первом использовании правил Storage разрешите чтение документов Firestore правилами.

На статический хостинг загрузите корневые HTML, JS, CSS и PNG вместе. Не загружайте секреты, локальные `.env.*` и node_modules. Каталог functions — исходники сервера; для его выполнения нужен deploy Firebase.

## 5. Проверка и запуск

В тестовом окружении зарегистрируйтесь, подтвердите почту, откройте аккаунт → UPDATE PRO. Проверьте покупки 39 € и 99 € тестовым способом оплаты Stripe. Webhook должен получить ответ 200; аккаунт — PRO и номер лицензии.

Отмена оставляет бесплатную версию. Открытие `?checkout=success` без подтверждённого платежа не активирует PRO. Полный возврат отнимает права этой покупки, сохраняя другие оплаченные покупки. Повторный webhook сохраняет тот же номер лицензии. Если вкладка закрыта после оплаты, webhook выдаст права; они появятся при следующем входе.

Для запуска замените цены, серверный ключ и webhook на рабочий режим, снова опубликуйте функции. Загрузка архива на GitHub сама по себе платежи не включает.

## Доступ

`createProCheckout` берёт пользователя из проверенной Firebase-сессии, цену — из конфигурации сервера. Webhook проверяет подпись, платёж и заказ. `confirmProCheckout` выполняет ту же проверку после возврата. Только сервер записывает `cloudLicenses/{uid}` и закрытые `proPurchases/{sessionId}`.

PRO привязан к Firebase-аккаунту, ручной ввод ключа не требуется. Для будущих EPS/CCTV/SK предусмотрены `APP_PRODUCT` и отдельные пути `/users/{uid}/apps/{application}/projects`. Эти три приложения данным обновлением не создаются.
