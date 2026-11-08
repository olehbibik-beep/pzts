# Stripe: ежемесячная подписка UPDATE PRO

Версия `20261108-monthly-ui-5`. Реализация находится в `functions`. Настройки вашего Stripe и публикация в рабочем Firebase ещё не выполнены. Статический сайт открывает Stripe Checkout, сервер Firebase выдаёт доступ после проверки оплаты.

## 1. Подготовка

В Firebase Authentication включите Google и Email/Password, разрешите домен сайта. Для публикации функций требуется Firebase Blaze: [инструкция Firebase](https://firebase.google.com/docs/functions/get-started). Тариф проекта в этой задаче не менялся.

Сначала используйте отдельный тестовый Firebase-проект и тестовый режим Stripe. Укажите его настройки в `config.js`, а в командах замените `pztsepscctv` на ID тестового проекта. Тестовые покупки не должны выдавать PRO в рабочей базе.

## 2. Создайте ежемесячные цены

| Продукт | Цена | Тип |
| --- | --- | --- |
| PZTS PRO | 39,00 EUR / месяц | Recurring, monthly, каждые 1 месяц |
| PRO Suite — PZTS, EPS, CCTV, SK | 99,00 EUR / месяц | Recurring, monthly, каждые 1 месяц |

**Price ID из предыдущего обновления с разовой оплатой не подходят.** Создайте новые ежемесячные цены и скопируйте два `price_...` ID. Сервер отклоняет разовые, годовые и многомесячные цены. Дополнительные налоги, скидки и сборы эта реализация не добавляет; итоговая сумма проверяется как 3900/9900 евроцентов.

Период начинается при покупке, затем продлевается ежемесячно от этой даты. Нет пробного периода и привязки к первому числу месяца. Для коротких месяцев Stripe использует соответствующий последний день: [расчёт даты продления](https://docs.stripe.com/billing/subscriptions/billing-cycle).

```powershell
Copy-Item functions/.env.example functions/.env.pztsepscctv
```

Заполните локальный файл:

```dotenv
APP_ORIGIN=https://pzts.five.surf
STRIPE_SINGLE_PRICE_ID=price_ВАША_ЕЖЕМЕСЯЧНАЯ_ЦЕНА_39
STRIPE_SUITE_PRICE_ID=price_ВАША_ЕЖЕМЕСЯЧНАЯ_ЦЕНА_99
```

Для тестового проекта имя файла — `.env.ID_ТЕСТОВОГО_ПРОЕКТА`, APP_ORIGIN — HTTPS-адрес тестового сайта. Цены, ключ и webhook должны принадлежать одному режиму Stripe. Сайт размещается в корне домена.

## 3. Управление подпиской

В Stripe Billing → Customer Portal включите портал. Разрешите обновление способа оплаты, просмотр счетов и отмену подписки **в конце оплаченного периода**. Автоматическую смену тарифов в портале не включайте: в этой версии нет расчёта доплат между тарифами. Одновременная повторная покупка пересекающихся прав блокируется, чтобы не оформить две подписки на PZTS.

После первой записи подписки в аккаунте появится **Spravovat předplatné / Manage subscription**. Сервер сам выбирает Stripe Customer текущего Firebase-пользователя. Чужой идентификатор нельзя передать из браузера. В аккаунте также показываются дата окончания доступа и состояние автопродления.

## 4. Webhook и секреты

В Stripe Workbench → Webhooks создайте **Snapshot** endpoint:

```text
https://europe-west1-pztsepscctv.cloudfunctions.net/stripeProWebhook
```

Для тестового проекта замените ID. Выберите события:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `charge.refunded`

Пока функции не опубликованы, endpoint ещё не отвечает. Скопируйте signing secret `whsec_...`. Продления происходят без открытой вкладки, поэтому webhook обязателен: [события подписки Stripe](https://docs.stripe.com/billing/subscriptions/webhooks).

Из корня проекта выполните команды и введите секреты в запросе CLI:

```powershell
firebase login
firebase functions:secrets:set STRIPE_SECRET_KEY --project pztsepscctv
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project pztsepscctv
```

Первый секрет — серверный `sk_...`, второй — `whsec_...` endpoint. Не публикуйте их в GitHub и не отправляйте в чат. Они хранятся в [Firebase Secret Manager](https://firebase.google.com/docs/functions/config-env). При смене секретов повторите deploy.

## 5. Публикация

Используйте Node.js 22 и Firebase CLI:

```powershell
npm --prefix functions ci
firebase deploy --project pztsepscctv --only "functions:pro-billing,firestore:rules,storage"
```

Функции: `createProCheckout`, `confirmProCheckout`, `createProPortal`, `stripeProWebhook`; регион `europe-west1`. При необходимости разрешите включение API и чтение Firestore правилами Storage.

На GitHub/статический хостинг загрузите корневые HTML, JS, CSS и PNG вместе. Секреты, `.env.*`, `node_modules` и `.qa*` туда не загружайте. Простая загрузка исходников functions на GitHub сервер не публикует.

## 6. Проверка до включения настоящих платежей

В тестовом окружении зарегистрируйтесь, подтвердите почту, откройте аккаунт → UPDATE PRO. Проверьте оба тарифа и успешную доставку webhook с кодом 200. После оплаты должны появиться номер лицензии, дата доступа и кнопка управления подпиской.

Проверьте продление с Stripe Test Clock, неуспешную оплату и отмену автопродления. Успешный оплаченный счёт продлевает доступ до конца своего периода. Неудачное списание не добавляет месяц; после окончания уже оплаченного периода облако и PRO закрываются. Отмена автопродления сохраняет текущий оплаченный период; окончательный `canceled` закрывает подписку. Полный возврат текущего месяца отключает его права. Следующий успешно оплаченный месяц может восстановить доступ.

Возврат на `?checkout=success` сам по себе ничего не активирует. Повторные и запоздалые события не должны выдавать бессрочный доступ или менять номер лицензии. Срок каждой программы проверяется отдельно — более поздняя подписка CCTV не продлевает закончившийся PZTS.

После проверки замените ключ, цены и webhook на рабочий режим, опубликуйте функции повторно. В этой задаче реальные платежи и автосписания не включались.

## Хранение прав

`proSubscriptions/{subscriptionId}` — закрытая серверная запись подписки, клиента Stripe и оплаченного счёта. `cloudLicenses/{uid}` — доступная владельцу запись PRO с `billingMode: monthly` и `applicationExpiresAt` для каждой программы. Писать её может только сервер. Правила Firestore/Storage проверяют срок по серверному времени; открытая старая вкладка не даёт бессрочного доступа.

Бесплатные фирменные ключи и прежние бессрочные записи не включают ежемесячный PRO. Файлы проектов не удаляются. В архиве только PZTS; права пакета подготовлены также для будущих EPS, CCTV и SK.
