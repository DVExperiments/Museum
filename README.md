# The Museum of the Pixel Universe

The history of the universe, and its memory. Follows the [Pixel Universe Shared Conventions](../Pixel_Universe_Shared_Conventions.md).

- **Galleries** (computed live): Hall of Champions, the Record Books, a Timeline of every major event, and the Law Library.
- **The Archive** (stored): a snapshot of every site's results for each complete month, kept as JSON in `archive/`, written nightly by a GitHub Action and never overwritten.

A reader of everything; nothing reads it for its own history. Glacial and the Weather Bureau are required; the Senate, City and Bookmaker wings close if those sites can't be reached. Opens 1 November 2026, with a collection reaching back to 3 December 2025.

## Setting up

1. Create the `DVExperiments/Museum` repo and upload everything here, including the hidden `.github/` folder.
2. Settings → Pages: publish from `main`, root.
3. Settings → Actions → General → Workflow permissions: choose **Read and write permissions**, so the curator can commit to `archive/`.
4. Actions tab → **Accession** → **Run workflow** to fill the archive straight away. After that it runs every night at 00:30 UTC.
5. Publish the Bookmaker's updated `universe.js` (version 0.2.0, which adds `marketsBetween`). Until then the Bookmaker's section is marked missing.

To run it on your own computer: `node tools/accession.mjs` (Node 18 or later). Add `--strict` to exit with an error if any month has been altered, or `--local <folder>` to test against local copies of the sites.

## What a snapshot holds

`archive/YYYY-MM.json`, one per calendar month (UTC):

| Section | Contents |
| --- | --- |
| `glacial` | Every race that ended that month: lineup, results `[pixel, finishMs or null, distance]`, winner, margin, rating changes |
| `weather` | Each day `[date, max, min, rain, gust, conditions, forecast correct 1/0]`, and events of importance 3+ |
| `senate` | Laws in force at the month's end, and events of importance 2+ |
| `city` | Each day `[date, peak MW, clean %, blackout hours, unserved MWh]`, and events of importance 2+ |
| `bookmaker` | Every settled market `[race, winner, starting price, bets, taken, paid]`, and each regular's balance at the month's end |

Each section has a checksum (`checksums`), and the code versions of each site are noted in `versions`.

## Conservation

Every night, and whenever someone presses **Check the whole collection**, the Museum recomputes each archived month with today's code and compares checksums. Each site's section is marked **intact** or **altered**. Results go in `archive/conservation.json`.

Use it as a safety check whenever you change a site: publish, run the Accession workflow by hand, and read the report. If a section says altered, your change rewrote history.

## Using the archive for a new era

When a change to a site *should* alter history, such as new race rules, follow the conventions' era process, and let the Museum hold the old era:

1. Pick the date the new era starts, ideally the 1st of a month, so the old era ends on a month the archive already holds.
2. Change the site so dates before the new era are read from the archive and dates after are computed by the new rules. For example, in Glacial:

```js
const ERA_2 = Date.UTC(2027, 0, 1);
async function oldRaces(monthKey) {   // e.g. "2026-10"
  const res = await fetch('https://dvexperiments.github.io/Museum/archive/' + monthKey + '.json');
  return (await res.json()).sites.glacial.races;
}
```

3. After publishing, the Museum will report that site as **altered** for months whose history the new code computes differently. That's expected: the archive keeps the history as it was, and the README of the changed site should record the era date.

The snapshots hold results, not every intermediate detail (such as each pixel's position minute by minute). If an old era needs more than this, add the fields to `snapshotMonth` in `universe.js` and bump `SNAPSHOT_FORMAT` *before* the change, so the extra detail is captured while the old code still runs.

## Repo layout

```
index.html                       the Museum
universe.js                      galleries and snapshots, no DOM (shared with the tool)
js/app.js                        rendering
css/style.css                    Glacial's variables, so Senate laws restyle the Museum
tools/accession.mjs              catalogues months and checks the archive
.github/workflows/accession.yml  runs the tool nightly
archive/                         the collection
```

## The Hall of Disasters

Every glitch (City's digital disasters, from 1 March 2027) that has run its course, as an exhibit: what kind, when, how long, how severe, every district it spread through, and what it did. Read from City's `glitchesBetween`. The timeline also carries glitches as they begin and spread.

The timeline now also carries the Exchange, the Bank and Society, and where an event knows its causes, it says why underneath. Each exhibit in the Hall of Disasters lists its consequences: businesses in the districts it struck that closed within three weeks, with the disruption among their causes.
