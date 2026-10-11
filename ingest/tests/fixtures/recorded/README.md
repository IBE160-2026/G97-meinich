# Recorded register responses

Responses from Brønnøysundregistrene's open APIs, stored byte for byte as the register returned them (except where noted), and replayed by the step-1 tests through `FixtureTransport` (`tests/conftest.py`). No test reaches the network.

Inneholder data under Norsk lisens for offentlige data (NLOD) 2.0 tilgjengeliggjort av Brønnøysundregistrene (<https://data.norge.no/nlod/no/2.0>). Source: <https://data.brreg.no>.

| File | Source URL | Recorded | Used for |
|---|---|---|---|
| `regnskap_979607008_2025.json` | `https://data.brreg.no/regnskapsregisteret/regnskap/979607008` | 2026-09 (copied from the gitignored `analysis/.cache`, file `c696f8694d337da2dcb31f5fa8f4d36c.json`; re-serialised by `analysis/industry_screening.py`, values unchanged) | The contract test (AD-14): hand-checked øre values, the year trap, `langsiktigGjeld: {}`, the misspelled fields, the non-whole and float-free cases |
| `regnskap_979607008.json` | `https://data.brreg.no/regnskapsregisteret/regnskap/979607008` | 2026-10-11 | Several years (2023–2025) in one response |
| `regnskap_923609016.json` | `https://data.brreg.no/regnskapsregisteret/regnskap/923609016` | 2026-10-11 | A millions reporter in USD; `SELSKAP` and `KONSERN` for the same period |
| `regnskap_967534579.json` | `https://data.brreg.no/regnskapsregisteret/regnskap/967534579` | 2026-10-11 | Demo company C's key figures in the end-to-end run |
| `regnskap_919951834.json` | `https://data.brreg.no/regnskapsregisteret/regnskap/919951834` | 2026-10-11 | The covered company in the end-to-end run; the non-whole, overflow and unreadable-response cases modify it in the test |
| `enhet_967534579.json` | `https://data.brreg.no/enhetsregisteret/api/enheter/967534579` | 2026-10-11 | Demo company C's Enhetsregisteret record |
| `enheter_lastned.json` | Built from `https://data.brreg.no/enhetsregisteret/api/enheter/{orgnr}` for 919951834, 990051232, 979607008 and 967534579 | 2026-10-11 | A small stand-in for the bulk download (`/enhetsregisteret/api/enheter/lastned`): a JSON array of the four records, gzipped by the test. 919951834 has the covered code as `naeringskode1`; 990051232 has it only as `naeringskode2` and must not be loaded |
