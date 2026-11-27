# Furniworld — PHP backend integration notes

## What was removed
- `.git` folder, `js/data.js` (157 KB demo seed data), `js/photos.js`, `tools/`, `assets/photos/`
- Browser database (localStorage), seed/migration code, cart-in-browser, order/mail flags in sessionStorage
- Client-side admin login (hard-coded `admin / FurniWorld@123`), "Reset demo data" buttons, backup/restore, storage-size meter
- Image resize-to-base64 code (images are no longer stored inside the browser)

## Where the PHP connection goes
All data reads/writes in the site pass through the `DB` object in **`js/store.js`**
(`getData`, `saveData`, `addItem`, `updateItem`, `deleteItem`, `getItemById`).
Each method is an empty stub marked `TODO PHP`. Collections used:
products, categories, orders, customers, inquiries, careers, vendors, feedback, gallery,
projects, services, team, newsletter, content (object), settings (object), cart, user.

Other `TODO PHP` markers:
| File | What is needed |
|---|---|
| `js/store.js` → `Media.process()` | upload the image to a PHP endpoint, return the saved path |
| `js/admin.js` → `A.guard()` | admin session must be verified by PHP before admin pages are served |
| `admin/login.html` | form now POSTs `username` / `password` to `admin/login.php` (create it); sign-out links to `admin/logout.php` |
| `js/admin-extra.js` → `A.replaceImg()` | replace an image path everywhere in the database |
| `js/content.js` → `EDIT` | true only when a PHP admin session is active (live-edit mode) |

Until these are filled, the pages load with no data (empty shop, empty admin tables).

## Kept as is
- E-mail: `api/send-mail.php`, `api/config.php`, `js/mailer.js`, mail routes in `js/config.js`
- Site contact details / social links in `js/config.js`
- All design, CSS, fonts, images in `assets/`
