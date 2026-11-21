# Подключение оплаты GooM

Состояние на 21.11.2026: платёжные функции в production ещё не развёрнуты. На сайте онлайн-оплата помечена «Скоро».

Подписка PROJECT включает PZTS, EPS, CCTV и SK. COMPANY PROJECT добавляет до трёх коллег с тем же доступом. Цены сохранены: PROJECT €6.90/месяц или €72.86/год; COMPANY PROJECT €8.90/месяц или €93.98/год.

1. Завершить настройку бизнес-аккаунта Stripe и создать четыре повторяющиеся цены EUR без trial: monthly, annual, companyMonthly, companyAnnual.
2. Задать STRIPE_SECRET_KEY и STRIPE_WEBHOOK_SECRET через Firebase Secret Manager; не хранить ключи в клиентском коде или GitHub.
3. В конфигурации Firebase функций указать STRIPE_MONTHLY_PRICE_ID, STRIPE_ANNUAL_PRICE_ID, STRIPE_COMPANY_MONTHLY_PRICE_ID, STRIPE_COMPANY_ANNUAL_PRICE_ID и APP_ORIGIN=https://goom.cz/pzts/.
4. Развернуть createProCheckout, confirmProCheckout, createProPortal, stripeProWebhook и goomCompanySeats из codebase pro-billing. На Stripe webhook направить события checkout.session.completed, checkout.session.async_payment_succeeded, customer.subscription.created/updated/deleted/paused/resumed, invoice.paid, invoice.payment_failed и charge.refunded.
5. Проверить сценарии в локальном Stripe sandbox: успешная оплата, продление, ошибка оплаты, возврат, отмена, доступ во всех четырёх редакторах и корпоративные места. Тестовый режим не подтверждает доставку настоящего письма.
6. В pro-billing.js всех четырёх программ включить billingEnabled и убрать пометку «Скоро» в текстах сайта после проверки конфигурации.

После подтверждённой оплаты сервер обновляет доступ и отправляет Stripe receipt на подтверждённый e-mail покупателя. Описание содержит тариф, PZTS/EPS/CCTV/SK и оплаченный период; Stripe добавляет сумму и валюту. Повторные уведомления используют ключ идемпотентности и приватную запись proPaymentReceipts. Исторические платежи задним числом не рассылаются. При ошибке отправки доступ сохраняется, webhook повторяет отправку. Это платёжная квитанция Stripe; налоговые реквизиты и счета задаются в бизнес-настройках Stripe.

Официальное API: https://docs.stripe.com/api/charges/update (description и receipt_email).
