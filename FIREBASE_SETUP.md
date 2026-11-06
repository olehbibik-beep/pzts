# Firebase setup for GOOM

GOOM stores cloud project metadata in Firestore and project files in Firebase Storage. Each signed-in user can read and change only their own projects.

1. In Firebase Console, enable **Google** under Authentication → Sign-in method.
2. Under Authentication → Settings → Authorized domains, add `pzts.five.surf`.
3. Create a Firestore database and enable the project's Firebase Storage bucket.
4. From this folder, deploy the owner-only rules:

   ```powershell
   firebase deploy --project pztsepscctv --only firestore:rules,storage
   ```

5. Serve GOOM over HTTPS. Google sign-in and cloud sync do not work from a `file://` page.

Firebase may require a billing-enabled plan for a newly created Storage bucket; confirm the project's current Firebase pricing requirements before enabling it.

The Firebase web configuration in `config.js` is public client configuration. Never put a service-account key or OAuth client secret in the web app.
