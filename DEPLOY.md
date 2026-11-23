# Server deploy (AppEndO-Release)

Copy **deploy.target.example.json** to **deploy.target.local.json** in **this publish repo**.

- `deployRoot` — production filesystem root
- `publicUrl` — optional public URL for smoke checks

`deploy.target.local.json` is preserved across release pushes and must not be committed.

## Production first boot

Create the empty control-plane database first (SQL Server does not create it for you).
Put connection and admin credentials in the environment, or in a gitignored file referenced by `APPENDO_DEPLOY_SECRETS_FILE`.
Do not commit that file.

From the deploy root (the directory that contains `dist/`, `packages/`, and `MANIFEST.json`):

```bash
export APPENDO_DEPLOY_NODE_ENV=production
export APPENDO_DEPLOY_SECRETS_FILE=./deploy.bootstrap.local.json
node dist/server.cjs
```

On that first start, if install is not finished and the credentials are present, the server writes `settings.json` (real JWT secrets in production), creates the admin, applies the control-plane schema and feature tables, and then installs `packages/*.zip` in dependency order after checking each SHA-256 against `MANIFEST.json`. An empty database and a database left by an older init both work. It then serves the full application. The next start is a no-op.
This path is inside `dist/server.cjs`. Run it from this directory (the one that contains `dist/`, `packages/`, and `MANIFEST.json`). `prisma/schema.prisma` and `src/generated` are read from `source/` when they are not next to `dist/`. It does not need `npm install` under `source/` or `tsx`.

The same values can be exported directly: `APPENDO_DB_HOST`, `APPENDO_DB_PORT`, `APPENDO_DB_NAME`, `APPENDO_DB_USER`, `APPENDO_DB_PASSWORD`, `APPENDO_ADMIN_USERNAME`, `APPENDO_ADMIN_EMAIL`, `APPENDO_ADMIN_PASSWORD`.
Host is a hostname or IPv4. Put the port in `APPENDO_DB_PORT`, not inside the host.

If first boot fails, the process logs that error and stays in install-pending. It does not exit. The browser install API stays closed in production. `APPENDO_LOCAL_PROD_PUBLISH` is not required. Set `APPENDO_ALLOW_HTTP_INSTALL=1` only to open `/install` on a trusted network.

### Post-install data

This line has no post-install data hook.
Bootstrap installs the bundled zips and stops. It does not import legacy data.

First boot does not run that hook. Set `APPENDO_DEPLOY_RUN_POST_INSTALL=1` only when you want it.
