# Day 10 QA Report

Date: 2026-06-30

## Automated Regression

Commands passed:

```bash
php artisan test
npm test
npm run build
```

Results:

- PHP: 53 tests passed, 351 assertions.
- JS: 10 tests passed.
- Vite build: passed.

Latest build assets after the mobile CSS fix:

- CSS: `public/build/assets/app-Oy-STMOu.css`, 352.12 kB, gzip 52.87 kB.
- JS: `public/build/assets/app-msOGt0pd.js`, 169.54 kB, gzip 43.27 kB.

## Browser Smoke Regression

Server used for QA:

```text
http://127.0.0.1:8001
```

Admin account used from local database:

```text
username: lemonade
```

The password was verified locally through the password hash for this QA run. Do not document real production passwords in commits.

Viewport checks:

| Case | Viewport | Path | Body overflow X | Loading visible | Console errors |
| --- | --- | --- | --- | --- | --- |
| Desktop dashboard | 1440x900 | `/admin/dashboard` | No | No | None |
| iPad portrait POS coffee | 768x1024 | `/pos/coffee` | No | No | None |
| iPad landscape POS fishing | 1024x768 | `/pos/fishing` | No | No | None |
| Mobile admin orders | 390x844 | `/admin/orders` | No | No | None |
| iPad landscape admin map | 1024x768 | `/admin/map` | No | No | None |

## Issue Found And Fixed

The first mobile smoke run found page-level horizontal overflow on `/admin/orders` at `390x844`:

- `bodyScrollWidth`: `1015`
- `viewportWidth`: `390`
- visible cause: desktop sidebar remained open at phone width.

Fix:

- Added `resources/css/responsive/mobile.css`.
- Imported it after `legacy-overrides.css` and before the iPad layer.
- Phone-width shell now uses a `72px` sidebar rail and confines wide tables to internal horizontal scroll containers.

Post-fix mobile result:

- app grid: `72px 318px`
- sidebar width: `72px`
- `bodyScrollWidth`: `390`
- `viewportWidth`: `390`
- label width: `0px`

## Screenshot Artifacts

Screenshots were saved under `/private/tmp` for this local QA run:

- `/private/tmp/donglay-day10-desktop-dashboard.png`
- `/private/tmp/donglay-day10-ipad-portrait-pos-coffee.png`
- `/private/tmp/donglay-day10-ipad-landscape-pos-fishing.png`
- `/private/tmp/donglay-day10-mobile-admin-orders-final.png`
- `/private/tmp/donglay-day10-ipad-landscape-admin-map.png`

These are intentionally not committed.

## Cleanup

- `database/exports/` is now ignored in `.gitignore`.
- Existing local dump `database/exports/donglay_fishing_orders_reset_20260625_111616.sql` remains on disk but should not enter refactor commits.

## Remaining Manual QA

The browser smoke confirms layout-level health for core screens, but it does not replace full business-flow QA. Before shipping, manually execute the flow checklist in `docs/regression-checklist.md`, especially:

- create/edit/merge coffee orders,
- start/extend/checkout fishing sessions,
- partial and full checkout with cash and QR methods,
- void/reverse admin payment flows,
- notification drawer interactions.

