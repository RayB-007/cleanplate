# Cleanplate

A local restaurant finder centered on official health inspections, with worldwide location search.

## Run

Requires Node.js 22 or newer. No dependency installation or API keys are needed.

```sh
git clone https://github.com/RayB-007/cleanplate.git
cd cleanplate
PORT=4317 npm start
```

Open http://localhost:4317, or double-click `Start Cleanplate.command` to start the server and open Safari.

## Worldwide search and coverage

Search a city, ZIP, or postal code worldwide. The country selector supports international postcode disambiguation. Ambiguous numeric searches ask the user to choose the matching location; alternative geocoder matches remain selectable.

Official inspection feeds currently connected:

- San Mateo County: current MyEHS public inspection report search, including Atherton ZIP 94027, Menlo Park and Redwood City. Native Pass / Conditional Pass / Failed/Closed outcomes and inspection findings. The discontinued 2022 open-data feed is deliberately not used.
- United Kingdom: Food Standards Agency FHRS/FHIS, including Scotland. Restaurants/cafés/canteens, native 0–5 ratings or Scottish outcomes.
- France: Ministry of Agriculture Alim’confiance, published restaurant sanitary outcomes.
- NYC: DOHMH violation points and reported grades.
- Chicago: CDPH Pass / Pass w/ Conditions / Fail.
- San Francisco: DPH Pass / Conditional Pass; latest closure records excluded.

The initial search is 94027. San Mateo results hide obvious campus/private facilities by default using facility-name patterns; users can include them with a toggle. This is a discovery heuristic, not an official public-access classification. Closed/terminated permits and latest Failed/Closed outcomes are excluded. Searches use the resolved town and exact ZIP when supplied. Large county city rosters are capped at 150 active permits with an explicit notice to narrow by ZIP.

Other locations resolve globally and show live OpenStreetMap restaurant directory listings near the location, clearly labeled **Inspection unknown**. These are sorted by proximity, never by an invented hygiene score. The global directory uses small map extracts (up to approximately 1.2 km from the location, shrinking for dense areas), rather than claiming exhaustive city or postcode coverage. Mapping completeness varies.

There is no universal public inspection database. Location lookup worldwide does not imply inspection coverage worldwide. The app never uses customer reviews as hygiene ratings or presents unverified restaurants as inspected.

## Freshness and scoring

Every search and refresh makes a new request to the connected public source. No inspection-result cache is used. The UI shows fetch time separately from inspection date. Public authorities publish on their own schedules; San Francisco describes its feed as monthly. Live fetching cannot make unpublished or older inspections current.

Scores retain the original local scales. NYC sorts fewer points first; UK sorts higher official hygiene ratings first; outcome-based sources sort their native statuses. Saved places are grouped by provider before ranking because authorities' scores cannot be directly compared.

Records are deduplicated to each business's latest published inspection within the searched area. NYC same-day ambiguity favors closures and then the higher score. NYC latest unscored records are excluded. NYC and Chicago searches use records from 2023 onward. San Francisco uses its 2024–present feed; San Mateo records retain the dates published by its current portal. The FSA provides latest ratings, while France publishes its currently public sanitary controls. Photos are explicitly labeled illustrative, not photographs of the listed venue.

## Geocoding and attribution

Location search uses OpenStreetMap Nominatim, with 24-hour geocoding cache, at most one request per second, and explicit submitted searches (no autocomplete). `GEOCODER_URL` can configure an alternative compatible endpoint. Location/directory data is © OpenStreetMap contributors, ODbL, linked in the interface. This implementation is designed for local interactive use; public high-volume deployments need appropriate geocoding and map-data infrastructure.

## Interface and motion

The app includes a skippable startup animation, animated hero artwork, loading skeletons, rating summaries, larger mobile cards, example searches, nearby county town shortcuts, and browser geolocation lookup. Intro motion is shown once per tab session, can be replayed from the footer, supports Escape/keyboard navigation, and is skipped for reduced-motion preferences.

The locally bundled “Preparing Food” animation by Joy M was sourced from LottieFiles under the Lottie Simple License. See `public/assets/ATTRIBUTION.md` for source and license links. The local Lottie runtime is version 5.13.0 (MIT); no external animation CDN is required at runtime.

Inspection calendar dates are displayed using the source's date rather than shifted by the viewer's timezone. Selected countries with no location match offer a worldwide retry. Unknown-inspection directory searches disable the recent-inspection filter so a leftover filter cannot silently hide all listings.

## Verify

```sh
npm run check
npm test
```

Live checks covered NYC ZIP 10012, UK postcode SW1A 1AA, France 75001, Chicago 60601, San Francisco, Mumbai directory lookup, and ambiguous postcode 1000. Browser checks covered search, saved places, NYC and UK inspection dialogs, global unknown status, and mobile layout.

Additional live verification: 94027 returns current San Mateo County records, with The Sandwich Spot and Mademoiselle Colette visible by default. Browser checks cover exact inspection dates, current violation reports, campus/private toggle, bookmarks, intro skip/replay, reduced motion, and mobile overflow.

## Cleanplate Lens

Lens is a local, explainable evidence-rules model. It is not an LLM, a trained or validated food-safety predictor, or an official inspection rating. It displays a separate assessment and preserves the source inspection status.

- Recent matched official outcomes support lower concern, caution, or avoiding a recent reported closure. Later favorable official outcomes can supersede earlier concerns.
- Unknown directory listings receive an automatic insufficient-evidence assessment. No missing data, food review, price, photo, or generic praise is interpreted as proof of cleanliness.
- Users can add up to five dated personal observations per place in the assessment dialog. These remain unverified; specific concerns can trigger a provisional caution, and positive practices remain unverified observations. Undated, future, and very old evidence is excluded. English wording support is limited and explained.
- Optional GDELT DOC 2.0 searches surface recent hygiene-related news leads. Headlines and unverified branch matches never determine the verdict. Requests are serialized at no more than one every 5.1 seconds; upstream unavailability or rate limiting is displayed explicitly. Google News RSS is not used.
- No API key is required. Observation text and model state are held in browser/server memory for the assessment; observations are not saved to files or submitted to the news index. The optional news request contains only the place name, city and hygiene search terms.

Assessment API: `POST /api/assessments` with a searched place ID, optional dated observations, and optional `research: true`. The server evaluates only records loaded from its upstream search providers; clients cannot supply an invented official rating. Requests require JSON, cap body size at 24 KB, and validate observations.

Regression cases include absent evidence, stale/future data, branch verification, same-branch reopening, negated pest reports, negated handwashing, raw ingredient preparation, generic requirements, unsupported praise, and news-only allegations.
