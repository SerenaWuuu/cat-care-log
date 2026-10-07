# Cat Care Log 🐱

A tiny, local-first journal for the tiny ruler of your house. Log feedings, water, weight, litter, vet visits, and meds in three taps, then watch the trends and streaks pile up.

**Live demo:** https://serenawuu.github.io/cat-care-log/ (after Pages is enabled, see Deploy below)

## Features

- **Quick log:** one-tap buttons for feeding (amount + food type), water, weight (kg/lb toggle), litter, vet visits, medication. Timestamps default to now, editable.
- **Dashboard:** weight trend line chart, meals-per-day bar chart, 7-day timeline, and a logging streak counter.
- **Cat profiles:** name, photo (stored on-device, auto-compressed), birthday with age display.
- **Multiple cats:** chip switcher in the Cats tab.
- **Your data, your device:** everything lives in `localStorage`. Export/import JSON backup, delete-all with a suitably dramatic confirmation.
- **Offline:** works offline after the first load (charts need the ECharts CDN on first paint).
- **Easter egg:** tap the cat avatar 7 times. You will not regret it.

## Tech

Plain HTML/CSS/JS, no build step. Charts via [ECharts](https://echarts.apache.org/) CDN. Mobile-first.

```
cat-care-log/
├── index.html        # single-page app shell
├── css/styles.css    # all styles, mobile-first
├── js/
│   ├── store.js      # data layer (localStorage, works in Node too)
│   ├── charts.js     # ECharts rendering
│   └── app.js        # UI wiring
└── test/
    └── store.test.js # node unit tests: node test/store.test.js
```

## Run locally

Just open `index.html` in a browser, or serve it:

```bash
cd cat-care-log
python3 -m http.server 8000
# open http://localhost:8000
```

Run the logic tests:

```bash
node test/store.test.js
```

## Deploy to GitHub Pages

This repo is designed to deploy as-is:

1. Push to the `main` branch of  `SerenaWuuu/cat-care-log`.
2. GitHub → repo **Settings → Pages**.
3. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch to **main**, folder to **/(root)**. Save.
4. Wait a minute, then visit `https://serenawuu.github.io/cat-care-log/`.

No build, no config files, no secrets. The app stores data in each visitor's own browser.

## Privacy

There is no backend, no analytics, no tracking. Photos and logs never leave the device except when *you* hit Export.

## License

MIT, see [LICENSE](LICENSE).
