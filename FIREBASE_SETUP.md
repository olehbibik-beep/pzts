# PZTS / GooM Special Edition — Firebase deployment

Release: `20261108-pro-ui-4`. Czech is the default; English is available. Publish the website, rules, and billing functions together. GitHub uploads do not deploy Firebase rules or functions.

## Authentication

Enable Google and Email/Password sign-in. Add `pzts.five.surf` to Authentication → Settings → Authorized domains. Review verification/password reset email templates. Keep the default Firestore database and Storage bucket configured in `config.js`.

Registration creates a free personal or company account. IČO validation checks eight digits and the checksum; it does not verify company representation or query ARES. Neither IČO nor email confirmation grants PRO. Confirmed email is required for purchasing PRO and accessing cloud projects.

References: [password authentication](https://firebase.google.com/docs/auth/web/password-auth), [email verification](https://firebase.google.com/docs/auth/web/manage-users).

## Paid access

| Purchase | One-time price | Applications |
| --- | --- | --- |
| PZTS PRO | 39 EUR | PZTS |
| PRO Suite | 99 EUR | PZTS, EPS, CCTV, SK |

UPDATE PRO in the account panel enables cloud plan storage, menu/icon editing and planning hints. Personal and company accounts can purchase. The suite entitlement supports four applications; this release contains PZTS only.

The server creates Stripe Checkout sessions using configured prices. A signed webhook or server confirmation retrieves and validates the payment, then writes the entitlement via Firebase Admin. Redirect parameters cannot activate PRO. Full refunds revoke the affected purchase while preserving other paid purchases. License IDs are account-bound references, not transferable login credentials.

See [STRIPE_SETUP_RU.md](STRIPE_SETUP_RU.md). Real payments have not been configured or deployed in this workspace.

## Data and rules

| Path | Purpose |
| --- | --- |
| `users/{uid}` | Owner profile, IČO, language |
| `cloudLicenses/{uid}` | Owner-readable, server-written paid entitlement |
| `proPurchases/{checkoutSessionId}` | Server-only receipts |
| `users/{uid}/projects/{projectId}` | Existing PZTS cloud metadata |
| Storage: `users/{uid}/projects/{projectId}/{fileName}` | Existing PZTS files |
| `users/{uid}/apps/{application}/projects/{projectId}` | Metadata namespace for each application |
| Storage: `users/{uid}/apps/{application}/projects/{projectId}/{fileName}` | Files for each application |

Rules check ownership, verified email, paid server entitlement, application and expiry. All browser writes to licenses are denied. Old free company keys do not satisfy the new rules; existing project files are not deleted.

```powershell
firebase deploy --project pztsepscctv --only "firestore:rules,storage"
```

Storage rules read Firestore licenses; initial deployment may ask to grant [cross-service access](https://firebase.google.com/docs/reference/security/storage#firestoreget).

## Website publishing

Upload all root HTML, JS, CSS and PNG together, including `ui-theme.css`, `select-controls.js`, `tablet-tools.js`, `pro-billing.js`, `account-profile.js`, `i18n.js` and `Hi.png`. `BAZE` is not the current application. Exclude dependencies, `.qa*`, local environment files and secrets. Functions run in Firebase, not on the static host.

Keep the version in `bootstrap.js` and references in `index.html` consistent. Refresh with Ctrl+F5 after publishing.

## Verification

```powershell
npm ci
npm --prefix functions ci
$env:TEST_FIREBASE_SDK_DIR=Join-Path (Get-Location).Path 'node_modules/firebase'
npm test
npm run test:billing
npm run test:firebase
```

UI tests use headless Microsoft Edge. Firebase tests require Java 21+ and Firebase CLI and run against local `demo-goom` Authentication, Firestore and Storage emulators. Billing tests use simulated Stripe responses and signature validation. The real-SDK flow uses Admin against emulators for trusted paid fulfillment. Tests do not modify production data or charge real cards.

Never put Stripe secret keys or service-account credentials in frontend files or the release archive.
