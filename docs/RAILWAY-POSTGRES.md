# Railway Postgres setup

Follow these steps in the [Railway dashboard](https://railway.com/dashboard) for the **coopdashborad** project.

## 1. Add PostgreSQL

1. Open your project canvas.
2. Click **+ New** → **Database** → **PostgreSQL**.
3. Wait until the Postgres service shows as deployed (green).

Railway creates a service named **Postgres** (or similar) with a `DATABASE_URL` variable.

## 2. Connect the app to Postgres

1. Click your **web app service** (the one deployed from GitHub, not Postgres).
2. Open the **Variables** tab.
3. Click **New Variable** → **Add Reference** (or **Reference Variable**).
4. Select the Postgres service.
5. Choose **`DATABASE_URL`**.
6. Save — the app should now have:

```bash
DATABASE_URL=${{ Postgres.DATABASE_URL }}
```

(The service name in the reference must match your Postgres service name on the canvas.)

7. Click **Deploy** if Railway shows staged changes.

## 3. Confirm required variables

On the **app service**, you should also have:

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude Vision extraction |
| `OPENXBL_API_KEY` | Xbox screenshot import |
| `DATABASE_URL` | Shared match storage (reference from Postgres) |

Railway sets `PORT` automatically — do not override it.

## 4. Verify after deploy

1. Open your app URL.
2. You should briefly see **Loading shared match data…**, then the dashboard.
3. Log a test match — open the app in another browser or device and confirm the same match appears.

## 5. Migrate old browser data (optional)

If you had matches saved in one browser’s localStorage before Postgres:

1. Open the app in that browser **after** step 4 is working.
2. On first load, if the shared database is empty but local data exists, the app automatically uploads those matches and clears the old local copy.

## CLI alternative

If you use the Railway CLI locally:

```bash
npx @railway/cli login
npx @railway/cli link
npx @railway/cli add --database postgres
```

Then add the reference variable in the dashboard (step 2 above), or set it on the linked app service:

```bash
npx @railway/cli variable set 'DATABASE_URL=${{ Postgres.DATABASE_URL }}' --service YOUR_APP_SERVICE_NAME
```

Replace `YOUR_APP_SERVICE_NAME` with the name shown on your app service tile.
