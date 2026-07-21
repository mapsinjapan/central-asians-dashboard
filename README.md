# Central Asians in Japan — Prefecture Dashboard

Single-page dashboard (Leaflet + Chart.js) exploring the geographic distribution,
nationality composition, visa status, and sex demographics of Central Asian
residents in Japan at the prefecture level.

## Files
- `dashboard.html` — page structure + CSS (loads app.js and data_inject.js separately for easier editing)
- `app.js` — all interactivity: filters, map choropleth, charts
- `data_inject.js` — embedded data as JS consts (DATA, GEO) — generated from the source spreadsheets below, do not hand-edit
- `data_bundle.json` — the processed data before injection (readable version of DATA)
- `jp_geo_simplified.json` — simplified Japan prefecture GeoJSON (readable version of GEO)
- `CAPinJAPdata.xlsx` (sheet "Table5") — raw Central Asian residence data by prefecture/visa/sex
- `Japan_foreign_by_pref.xlsx` — total foreign resident counts by prefecture (denominator for index calcs)
- `jp_original.json` — original unmodified Japan GeoJSON (prefecture codes were "JP01" format, already fixed in jp_geo_simplified.json to plain "1")

## Key logic
- Overall map index = (CA% of foreigners in prefecture) / (national CA% of foreigners) * 100
- Filtered-by-country map index = (country's %-of-CA-in-prefecture) / (country's national %-of-CA) * 100
- Index 100 = matches national baseline, >100 = over-indexed (red), <100 = under-indexed (blue)

## To rebuild dashboard.html as one standalone file (for sharing):
Inline the contents of data_inject.js and app.js into <script> tags in dashboard.html,
replacing the two <script src="..."> lines.
