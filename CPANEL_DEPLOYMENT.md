# Spaceship cPanel deployment

ClientLoop is a dynamic Next.js/Node.js application. Do not upload only `.next`, `out`, or another build folder to `public_html`. Create a Node.js application in cPanel and upload the project to an application root outside `public_html`; cPanel/Passenger connects the selected domain to it.

## 1. Create the domain and HTTPS

Add or select the production domain/subdomain in Spaceship and confirm its SSL certificate works before configuring authentication. This guide uses `https://app.example.com` as a placeholder.

## 2. Create the MariaDB/MySQL database

In cPanel, open **Database Wizard** or **Manage My Databases**.

1. Create a database named `clientloop`.
2. Create a dedicated database user, for example `clientloop_app`, with a long unique password.
3. Add that user to the database.
4. Select **All Privileges**.
5. Record the complete names shown by cPanel. cPanel normally prefixes both names with the account username.

Construct the connection string using the complete names:

```text
mysql://FULL_DATABASE_USER:URL_ENCODED_PASSWORD@localhost:3306/FULL_DATABASE_NAME
```

If the password contains `@`, `:`, `/`, `#`, `?`, `%`, or spaces, URL-encode it before placing it in the URL.

## 3. Create private poster storage

The uploads directory must be outside `public_html` and outside any domain document root. Open **Manage Shell** / Terminal and run:

```bash
mkdir -p /home/CPANEL_USER/clientloop_uploads
chmod 700 /home/CPANEL_USER/clientloop_uploads
```

Replace `CPANEL_USER` with the current cPanel username. Do not create a public URL or symlink for this directory; images are delivered only by the authenticated application route.

## 4. Create the Node.js application

Open **Setup Node.js App** and select **Create Application**:

- Node.js version: **22**
- Application mode: **Production**
- Application root: `clientloop-app`
- Application URL: the production domain/subdomain
- Application startup file: `app_wrapper.cjs`

The resulting source directory is `/home/CPANEL_USER/clientloop-app`. Leave `public_html` unchanged; the Node.js application mapping handles the domain.

## 5. Upload the project

Upload these items into `/home/CPANEL_USER/clientloop-app`:

- `src`
- `public`
- `drizzle`
- `scripts`
- `package.json` and `package-lock.json`
- `next.config.ts`, `tsconfig.json`, and `next-env.d.ts`
- `server.js` and `app_wrapper.cjs`

Do not upload local `node_modules`, `.next`, `.git`, test reports, or your development `.env.local`.

## 6. Add environment variables

In **Setup Node.js App**, add:

```text
NODE_ENV=production
DATABASE_URL=mysql://FULL_DATABASE_USER:ENCODED_PASSWORD@localhost:3306/FULL_DATABASE_NAME
NEXT_PUBLIC_APP_URL=https://app.example.com
BETTER_AUTH_URL=https://app.example.com
BETTER_AUTH_SECRET=LONG_RANDOM_SECRET
UPLOAD_ROOT=/home/CPANEL_USER/clientloop_uploads
SUPER_ADMIN_EMAIL=your-admin-email@example.com
SUPER_ADMIN_NAME=ClientLoop Super Admin
SUPER_ADMIN_PASSWORD=YOUR_INITIAL_PASSWORD_OF_AT_LEAST_12_CHARACTERS
```

Generate `BETTER_AUTH_SECRET` in Terminal with:

```bash
openssl rand -base64 48
```

Do not add `VERCEL_OIDC_TOKEN` or any `S3_*` variables. Save the application settings after adding the variables.

## 7. Install, migrate, bootstrap, and build

At the top of the Node.js application page, copy and run the displayed virtual-environment activation command. Then run:

```bash
cd /home/CPANEL_USER/clientloop-app
npm ci
npm run db:validate
npm run db:migrate
npm run auth:bootstrap
npm run build
```

The build script uses Webpack because some shared-hosting Linux images provide
WebAssembly SWC bindings but cannot load the native Turbopack binary.

If Terminal commands cannot see the environment variables configured in **Setup Node.js App**, create `/home/CPANEL_USER/clientloop-app/.env.production.local` through File Manager using the same values, set its permissions to `600`, run the commands, and keep the file private.

The migration creates all 19 application and Better Auth tables. Do not create those tables manually in phpMyAdmin and do not import the old PostgreSQL migrations.

## 8. Start and verify

Return to **Setup Node.js App** and click **Restart**. Test:

1. `https://app.example.com/api/v1/health`
2. `https://app.example.com/login`
3. Sign in as the Super Admin.
4. Create a company and project.
5. Upload a JPG/PNG/WebP/GIF poster.
6. Sign in as the company account and confirm only that company's poster is visible.

After the first successful login, remove `SUPER_ADMIN_PASSWORD` from the cPanel application variables and from `.env.production.local`, then restart the application. It is not required during normal runtime.

## Updating the application

Upload the changed source files to the application root, activate the Node.js virtual environment, and run:

```bash
cd /home/CPANEL_USER/clientloop-app
npm ci
npm run db:migrate
npm run build
```

Then restart the application in **Setup Node.js App**. Do not replace `public_html` with the `.next` folder.

## Backups

Back up both resources together:

- The complete cPanel MySQL database.
- `/home/CPANEL_USER/clientloop_uploads`.

A database-only backup cannot restore uploaded posters, and an uploads-only backup cannot restore their permissions or metadata.
