# IWK Report Template

Public static web app for preparing a printable A4 IWK sewerage engineering
report from manually entered project information.

Expected GitHub Pages URL:

```text
https://hafize92.github.io/ur20a-report-template/
```

## How It Works

- The app is static HTML, CSS and JavaScript.
- Multiple users can open the same HTTPS link from their own laptops.
- Each browser profile keeps its own saved project copies through browser storage.
- Project data is not shared between users unless a user exports and sends a JSON
  record manually.
- The PDF is created through the browser print dialog with `Print / Save PDF`.

## Files

- `index.html` - report-template interface and print preview shell.
- `src/app.js` - browser app logic, rendering and JSON import/export.
- `src/report-model.js` - default record, validation, formula and calculation model.
- `src/styles.css` - screen and printable A4 styling.

## Local Check

```powershell
npm test
npm run build
npm start
```

Then open:

```text
http://localhost:4174/
```

Localhost is only for development. Users should use the GitHub Pages HTTPS link.

## Version

`Hafize | Version 1.0.8` is visible in the template interface only and is excluded
from the printed PDF.
