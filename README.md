# Bantay Antiao

**Mapping Risks. Mobilizing Communities. Protecting Watersheds.**

**Integrated Watershed Decision-Support and Community Monitoring Platform** for **Catbalogan City, Samar**.

> One watershed. One evidence map. Better local decisions.

Environmental data → pressure assessment → community evidence → scenario analysis → recommended action.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

No accounts or keys are needed for local preview. Without Supabase settings the app runs in **local demo mode**: reports and accounts are stored in the browser, and sync in real time between tabs of the same browser only.

## Supabase setup (the online backend)

Supabase holds the accounts, reports, status history and photos, so every device sees the same data. This path is written but has **not been run against a real project yet**; test it before relying on it.

1. Create a project at [supabase.com](https://supabase.com/).
2. In the dashboard open **SQL Editor**, paste all of [supabase/schema.sql](./supabase/schema.sql) and run it.
3. In **Authentication → Sign In / Providers → Email**, switch **Confirm email** on. Sign-up asks for a Gmail address and Supabase mails a confirmation link to it; the account cannot log in until the link is opened and an administrator approves it.
   - In **Authentication → URL Configuration**, set **Site URL** to the address the site is opened at (for example `http://localhost:5174`), so the link in the email comes back to the app.
   - Supabase's built-in mail sender only delivers to the project's own team members and is tightly rate-limited. To send to any Gmail address, add your own mail service under **Authentication → Emails → SMTP Settings**.
4. In **Project Settings → API**, copy the project URL and the `anon` public key into `.env.local` in this folder:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```

   Use only the `anon` key. Never put the `service_role` key in the website or commit `.env.local`.

5. Run [supabase/seed.sql](./supabase/seed.sql) once in the SQL Editor. It creates the administrator account (username `admin`, password `admin123`), already approved. Then restart `npm run dev` and log in.
6. Every later sign-up waits on the administrator's **Accounts** page until it is approved.

Tables: `profiles` (accounts and their verification), `reports`, `report_updates` (status history), `report_internal` (staff notes), `scenarios`. Photos go to the `report-photos` storage bucket. Residents send reports and look up a status without an account, through the `submit_report` and `report_status` database functions.

To test the website on a phone over Wi-Fi, open the Network URL printed by Vite. Local demo storage is per browser, so sharing data between devices needs Supabase.

## Project NOAH hazard map

The landing page opens on an interactive GIS hazard map of Catbalogan City (at the very top, above the
hero) with **Project NOAH** flood (100-year rain return) and landslide hazard layers, a search bar for barangays, municipalities and places, and a read-out of the hazard at any
point you click.

- **What NOAH offers.** Project NOAH (UP Resilience Institute) has no public API. Its website draws the maps from
  private Mapbox tilesets, which we do not use. It does publish its hazard maps as downloadable shapefiles under the
  **Open Database License (ODbL)**. That is what this app uses.
- **How it gets here.** `npm run hazards` (`scripts/build-hazards.mjs`) downloads the Samar province
  flood and landslide shapefiles (about 750 MB, from the BetterGov.ph public mirror of the NOAH downloads), rasterises
  them to 11 m cells, clips them to Catbalogan City and writes two small PNG overlays (`src/assets/hazard-*.png`),
  `src/data/hazards.json` and `src/data/admin.json`. The app loads only those files, so there is no runtime
  dependency on NOAH or the mirror.
- **Licence duty.** ODbL is share-alike: the clipped hazard files in this repo are also ODbL, and the attribution
  ("Project NOAH, UP Resilience Institute") must stay visible. It is shown on the map, the home page footer and the
  Data Sources page. Bantay Antiao is not affiliated with or endorsed by Project NOAH.
- **Not a forecast.** The layers are modelled hazard maps from files dated 2021. The interface says so wherever they
  appear.
- **In the risk score.** NOAH landslide exposure makes up half of the "Slope & Landslide" driver and NOAH flood
  exposure half of the "Rainfall & Flood" driver. The weights are unchanged, so hazard is not counted twice.

## Barangay reporting workflow

Resident → barangay official → municipal / environmental office.

1. A **resident** pins the location, **chooses the barangay** (the pin only suggests one; routing never relies on GPS
   alone), adds a title, description, photo, severity, and an optional contact they can keep private.
2. The report goes to the **barangay official** for that barangay, who reviews and verifies it, then either handles it
   locally or forwards it to **MENRO**, **MDRRMO** or another LGU office.
3. The **office** reviews it, assigns personnel, records actions and resolves it.

Statuses: Submitted → Under Barangay Review → Verified → Forwarded to Responsible Office → Under Office Review →
Action in Progress → Resolved → Closed. Residents see each stage and its time. Notes, messages, assignments and
follow-ups between the barangay and the office are staff-only. Reports flagged as an emergency show the hotline notice
and are visible to the MDRRMO at once. Only verified, still-open reports count toward the Watershed Pressure Index.

Not built: push / SMS / email notifications (there is an in-app count on the Reports tab), file attachments on staff
messages, and editing a report after it is sent.

## Three-minute demo script

Accounts: the administrator is `admin` / `admin123` (created automatically in local mode; by `supabase/seed.sql` online).
Residents need no account. Barangay officials sign up and wait for the administrator to approve them.

1. Open the site. The landing page introduces the system; **Explore Map** opens the 3D hazard map on the Antiao Watershed.
2. Drag the pin: the flood, landslide and storm surge cards update, and the outline of that spot's catchment is drawn.
3. Try the weather simulation, then scroll down to **Risk analysis** for the barangay under the pin: pressure index, drivers, actions and the what-if sliders.
4. **Community Reports**: pick a category, choose barangay **Mercedes** (the pin drops there), add a photo and send. Note the reference number.
5. **Sign up** as a barangay official for Mercedes. Log in as `admin`, open **Accounts** and approve the sign-up.
6. Log in as the official: open the report → **Start barangay review** → **Verify report** → **Forward to office** (MENRO).
7. Log in as `admin`: open it → **Start office review** → **Start action** → **Mark resolved**, or **Archive report**.
8. Back on Community Reports, type the reference number to see its status as a resident would.
9. Finish on **Data Sources**.

**Reset demo** restores the sample reports.

## What is real and what is placeholder

| Item | Status |
| --- | --- |
| Flood and landslide hazard layers | **Official** — Project NOAH (UP Resilience Institute), ODbL, files dated 2021 |
| Hazard shares per barangay | Computed from the NOAH layers |
| Study area and barangay boundaries | Real but indicative — Catbalogan City and its 57 barangays, PSGC 4Q 2023 (PSA / NAMRIA) via faeldon/philippines-json-maps |
| Antiao River, streams, place points | Real — OpenStreetMap (Overpass extract, 2026-10-06) |
| Basemap, terrain view | Real — OpenStreetMap / OpenTopoMap tiles |
| Watershed / water-source boundary | **Not loaded.** The city boundary is used as the study area, and barangays are the management units |
| Land cover, slope, rainfall, population, riparian shares | **Sample values** in `scripts/generate-gis.mjs` |
| Watershed Pressure Index, what-if results, recommended actions | Prototype indicator and rules, not official assessments |
| Seeded community reports | Demo content |

Per-barangay land cover, slope, rainfall and population are generated by formulas (mostly distance from the city
centre), so the pressure index ranking is illustrative. The NOAH hazard shares are real.

### Swapping in real data

`scripts/generate-gis.mjs` stands in for the QGIS workflow and writes `src/data/gis.json`. Replace its output
with QGIS exports that keep the same property names (`forest_pct`, `farmland_pct`, `settlement_pct`,
`expected_forest_pct`, `mean_slope`, `rainfall_mm`, `population`, `area_km2`, `riparian{…}`), then update
`src/lib/sources.js`.

## Watershed Pressure Index

`WPI = 0.25F + 0.20S + 0.15R + 0.15P + 0.15W + 0.10C`, each factor 0–100. Low 0–24, Moderate 25–49, High 50–74,
Critical 75–100. Weights and normalisation ranges live in `src/lib/wpi.js`; they are prototype settings that
need expert validation. Only **verified, unresolved** reports feed `C`.

Recommendations come from plain rules in `src/lib/actions.js`. There is no AI or ML anywhere in the app.

## Project layout

```
scripts/generate-gis.mjs   GIS pre-processing (OSM fetch, schematic units)
src/data/gis.json          Pre-processed GeoJSON bundle (~130 kB)
src/lib/wpi.js             Index, normalisation, scenario logic
src/lib/actions.js         Rule-based action engine
src/lib/sources.js         Dataset register + Data Confidence
src/lib/store.js           Reports store (Supabase or local preview)
src/lib/accounts.js        Accounts and their verification by an administrator
src/pages/Landing.jsx      Public landing page; PublicSite.jsx is the public shell (styles in site.css)
src/components/HazardRiskMap.jsx  The 3D hazard map with the risk analysis under it (public and signed in)
src/pages, src/components  Sign-in, Dashboard, Reports, Data Sources, About, mobile report wizard
supabase/schema.sql        Tables, access rules and functions for the Supabase backend
supabase/seed.sql          Approves the first administrator
```

Deploy: `npm run build` and publish `dist/` to Vercel or Netlify (hash routing, no rewrites needed). Configure the same `VITE_SUPABASE_*` variables in the hosting environment.

## Before going live

- **Supabase is untested.** The schema, access rules and client code have not been run against a live project. Try every role (resident report, barangay official, office administrator) before a demo that depends on it.
- **Mobile app.** The earlier Flutter app used Firebase and is not connected to this backend.
- **Sample administrator.** In local mode the account `admin` / `admin123` is created automatically. Change that password before real use.
- **Search engines.** `index.html` has the title, description, Open Graph tags and structured data;
  `public/robots.txt` and `public/sitemap.xml` need `YOUR-DOMAIN` replaced after deployment. The app uses hash
  routes, so search engines index it as a single page.
