# Подключение оплаты GooM

Состояние на 21.11.2026: платёжные функции в production ещё не развёрнуты. На сайте онлайн-оплата помечена «Скоро».

Подписка Pro включает PZTS, EPS, CCTV и SK. Team добавляет до трёх коллег с тем же доступом. Цены с 25.11.2026: Pro 990 Kč/месяц или 10 454 Kč/год; Team 1 485 Kč/месяц или 15 681 Kč/год (ровно ×1,5 к Pro). Годовая скидка около 12%, сумма округлена до целых крон.

1. Завершить настройку бизнес-аккаунта Stripe и создать четыре повторяющиеся цены CZK без trial: monthly = 99000, annual = 1045400, companyMonthly = 148500, companyAnnual = 1568100 в минимальных единицах валюты (haléř).
2. Задать STRIPE_SECRET_KEY и STRIPE_WEBHOOK_SECRET через Firebase Secret Manager; не хранить ключи в клиентском коде или GitHub.
3. В конфигурации Firebase функций указать STRIPE_MONTHLY_PRICE_ID, STRIPE_ANNUAL_PRICE_ID, STRIPE_COMPANY_MONTHLY_PRICE_ID, STRIPE_COMPANY_ANNUAL_PRICE_ID и APP_ORIGIN=https://goom.cz/pzts/.
4. Развернуть createProCheckout, confirmProCheckout, createProPortal, stripeProWebhook из codebase pro-billing. Сервисы goomAdmin и goomCompanySeats разворачиваются отдельно из codebase project-cloud и не требуют секретов Stripe. На Stripe webhook направить события checkout.session.completed, checkout.session.async_payment_succeeded, customer.subscription.created/updated/deleted/paused/resumed, invoice.paid, invoice.payment_failed и charge.refunded.
5. Проверить сценарии в локальном Stripe sandbox: успешная оплата, продление, ошибка оплаты, возврат, отмена, доступ во всех четырёх редакторах и корпоративные места. Тестовый режим не подтверждает доставку настоящего письма.
6. В pro-billing.js всех четырёх программ включить billingEnabled и убрать пометку «Скоро» в текстах сайта после проверки конфигурации.

После подтверждённой оплаты сервер обновляет доступ и отправляет Stripe receipt на подтверждённый e-mail покупателя. Описание содержит тариф, PZTS/EPS/CCTV/SK и оплаченный период; Stripe добавляет сумму и валюту. Повторные уведомления используют ключ идемпотентности и приватную запись proPaymentReceipts. Исторические платежи задним числом не рассылаются. При ошибке отправки доступ сохраняется, webhook повторяет отправку. Это платёжная квитанция Stripe; налоговые реквизиты и счета задаются в бизнес-настройках Stripe.

Официальное API: https://docs.stripe.com/api/charges/update (description и receipt_email).
