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

## Publishing this web app update

Upload these six files to the repository root together in one commit:

- `index.html`
- `app.js`
- `firebase-auth.js`
- `firebase-sync.js`
- `bootstrap.js` (new)
- `device-support.js` (new)

Keep the other existing application files and images in place. After the hosting deployment finishes, refresh the page once with Ctrl+F5 to replace any cached HTML. The bootstrap loads the application scripts with a shared version; bump that version and the two versioned script references in `index.html` for subsequent releases.

The welcome screen checks the saved Firebase Authentication session before showing the account and the project button. A rejected or expired session returns to sign-in. Firestore rules govern project data; Google sign-in must also be enabled separately in Firebase Authentication. See [Firebase's user management documentation](https://firebase.google.com/docs/auth/web/manage-users).

Phones show a device notice before application or Firebase scripts load, including in landscape. Tablets and computers need a viewport at least 600 CSS pixels wide; a narrower desktop window can be widened without reloading. Tablet input supports taps, dragging, and two-finger pan/zoom.
