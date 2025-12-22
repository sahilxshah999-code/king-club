
# How to Deploy to InfinityFree (Manual Method)

Since the automated system (GitHub Action) is timing out due to the firewall, you must upload the files manually. This is the most reliable method for free hosting.

## Step 1: Build the Website
You need to convert the code into HTML, CSS, and JS files.

1. Open your project terminal.
2. Run the build command:
   ```bash
   npm run build
   ```
   *(If you are on a phone/web editor, look for a "Build" or "Export" button).*

3. This creates a folder named **`dist`**. This folder contains your real website.

## Step 2: Upload to Server
1. Login to your **InfinityFree Control Panel**.
2. Open the **"Online File Manager"**.
3. Navigate into the **`htdocs`** folder.
4. **DELETE** everything currently inside `htdocs` (like the default `index2.html`).
5. **UPLOAD** everything from inside your local **`dist`** folder into `htdocs`.
   - You should see `index.html`, `index.php`, `.htaccess`, and an `assets` folder inside `htdocs`.

## Step 3: Visit Your Site
Go to your website URL (e.g., `kingclub.rf.gd`). It should load instantly!

---

### Troubleshooting
- **White Screen?** ensure you uploaded the *contents* of `dist`, not the `dist` folder itself.
- **404 on Refresh?** Ensure the `.htaccess` file was uploaded. (Note: Some file managers hide dotfiles; this is normal, it's still working).
