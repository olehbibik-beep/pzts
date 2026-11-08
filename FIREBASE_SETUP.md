# Firebase setup and deployment for GOOM

The interface defaults to Czech and supports English. The selected language is saved in the browser. The application is a static website; cloud access is enforced by Firestore and Storage rules.

## Enable registration

1. In Firebase Console → Authentication → Sign-in method, enable **Google** and **Email/Password**.
2. Under Authentication → Settings → Authorized domains, include `pzts.five.surf` and any other domain used to serve this application.
3. Keep the default Firestore database and the bucket from `config.js` enabled. Project metadata is stored in Firestore; project files are stored in Firebase Storage.
4. Review the email verification and password reset templates in Authentication → Templates. GOOM selects the email language using the current Czech/English interface language.

Official references: [email/password authentication](https://firebase.google.com/docs/auth/web/password-auth), [user management and email verification](https://firebase.google.com/docs/auth/web/manage-users).

## Publish the rules and website together

From the extracted update directory, publish the included rules:

```powershell
firebase deploy --project pztsepscctv --only "firestore:rules,storage"
```

Publish all `.html`, `.js`, and `.png` files from the update archive to the website repository root in one commit. Include the new `i18n.js`, `account-profile.js`, and the updated transparent `Hi.png`. Refresh the deployed site once with Ctrl+F5.

This release uses version `20261108-accounts-cs-en-3`. Future releases must update the version in `bootstrap.js` and the script references in `index.html`. The image URL is versioned as well.

Publishing files to GitHub does not publish Firebase rules. Both deployment steps are needed for this release. Storage rules read Firestore profile and license documents; the Firebase deployment flow may request permission for this cross-service access. See [Storage rules and Firestore access](https://firebase.google.com/docs/reference/security/storage#firestoreget).

## Account and key flow

- Google sign-in and email/password sign-in are available. Existing Google users initially receive a personal profile; they can select **Firma** and enter IČO in account settings.
- Personal accounts can create, import, export, and resume local projects. Their account button opens user information and settings, and makes no cloud-project requests.
- A company account provides an eight-digit Czech IČO. Both the application and Firestore rules check the format and check digit. Registration is self-service; it does not perform an ARES lookup or verify representation of the company.
- A company must confirm its email address. The account screen has **E-mail jsem ověřil(a)** / **I have verified my email** to refresh verification and issue the key automatically. A subsequent verified sign-in also completes issuance.
- The browser generates a 192-bit random key using Web Crypto. A Firestore transaction records the entitlement only if the server rules accept the authenticated, email-verified company profile. No Cloud Functions deployment is required.
- Firestore stores only the key's SHA-256 hash and final eight characters. The complete key is shown in memory after issuance and can be copied. It is not put in localStorage or the project file. After a reload, the user sees a masked key and can generate a replacement.
- Cloud access is bound to that authenticated Firebase user, the company profile, and the issued license document. A key is an account entitlement identifier, not a transferable login credential or a Firebase API key. Company users can access only their own project namespace.

Collections:

| Path | Purpose |
| --- | --- |
| `users/{uid}` | Name, email, account type, IČO, language, timestamps |
| `cloudLicenses/{uid}` | Issued company entitlement and key hash |
| `users/{uid}/projects/{projectId}` | Cloud project metadata |
| Storage: `users/{uid}/projects/{projectId}/{fileName}` | Cloud project files |

The included rules deny cloud project/file access without the verified company entitlement. A personal profile cannot grant access by adding client-controlled authorization fields. The old unrestricted owner-only project rules must be replaced by these rules.

## Verification

The workspace includes repeatable tests:

```powershell
npm ci
npm test
npm run test:firebase
```

The Firebase tests use the `demo-goom` project in local Authentication, Firestore, and Storage emulators, with Java 21 and the Firebase CLI. The UI tests use installed Microsoft Edge in headless mode. Set `TEST_FIREBASE_SDK_DIR` to `node_modules/firebase` to include the real SDK startup smoke test.

Validation completed for this release: 19 UI/startup tests and 10 real Firebase emulator tests, including email registration, confirmation, automatic key issuance, cloud save/open, sign-out and email sign-in, plus unauthorized-access cases.

The public Firebase web configuration remains in `config.js`. Do not add service-account credentials or OAuth client secrets to the website.
