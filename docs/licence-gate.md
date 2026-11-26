# Licence gate: derived categories from the filed documents

**Decided by Meinich, 2026-11-25 (Story 5.4, checkpoint 1, decision 4): the gate is closed.** The result is recorded in `docs/licence-gate.json` as `{"open": false, "assessment": "docs/licence-gate.md", "date": "2026-11-25"}`, which `pnpm seed:export` reads.

The question: is it low risk to commit fingerprint categories (`register.fingerprint`) for companies outside `seed/allow-list.json`? The categories are derived from figures that step 1 reads from filed annual-account documents. This is not legal advice. It records what the sources say and how Peerless uses them.

## What the categories are

A fingerprint holds six things per company and year, all computed by `src/engine/fingerprint.ts`:
- three shares, each given only as a band (low, middle or high, or a range of bands): cost of goods, personnel cost and asset intensity;
- two yes/no flags: inventory and capitalised intangibles;
- a digest of the inputs.

A fingerprint contains no figure, no text and no layout from a filing, and the figures cannot be recovered from it. The figures themselves are a different matter: they are committed only for the allow-list, the declared sample, whatever the gate decides.

## What the sources say (read 2026-11-25)

**The APIs are NLOD 2.0.**
- The Enhetsregisteret API's OpenAPI document declares `"license":{"name":"Norsk lisens for offentlige data (NLOD)","url":"https://data.norge.no/nlod/no/2.0"}`.
- data.norge.no lists the Regnskapsregisteret distribution *Nøkkeltall fra Årsregnskapet* under "Norsk lisens for offentlige data".
- brreg.no says: "Datasettene følger Norsk lisens for åpne data (NLOD)" and "Det er ikke nødvendig å registrere seg for å ta datasettet i bruk."

**The filed documents have no stated licence.**
- On data.norge.no, two Regnskapsregisteret distributions both read "Lisens: Ikke oppgitt" and "Rettigheter for bruk: Ikke oppgitt":
  - the free retrieval ("Årsregnskap kan hentes ut gratis.");
  - the image-copy service ("Tjenesten er gebyrbelagt.").
- The dataset page is marked "Avpublisert" and was last updated on 2025-10-09.
- The accounts API's OpenAPI document (`/regnskapsregisteret/regnskap/v3/api-docs`, version 1.1.16) has an `info` block with only `title` and `version` and no `license`. Its path `/regnskapsregisteret/regnskap/aarsregnskap/kopi/{orgnr}/{aar}` is the one step 1 fetches.

**The documents are public. That gives a right of access, not a reuse licence.**
- Regnskapsloven § 8-1 (1): "Årsregnskapet, årsberetningen, revisjonsberetningen … er offentlige. Enhver har rett til å gjøre seg kjent med innholdet av denne rapporteringen hos den regnskapspliktige eller hos Regnskapsregisteret."
- Åndsverkloven § 33: "Vern etter denne loven er ikke til hinder for dokumentinnsyn etter forvaltningsloven og offentleglova eller annen lovgivning."
- § 34: documents given access to under § 33 "kan ikke brukes i strid med denne loven."

**What the Act protects.**
- **§ 24 (databases).** It gives the maker of a database "hvor innsamling, kontroll eller presentasjon av innholdet innebærer en vesentlig investering" an exclusive right over "hele eller vesentlige deler av databasens innhold ved uttrekk fra eller gjenbruk av databasen". The same applies to "gjentatt og systematisk uttrekk eller gjenbruk av uvesentlige deler" when this "skader den normale bruken av databasen eller urimelig tilsidesetter fremstillerens legitime interesser".
- **Copyright (§ 1 and § 2).** It protects a work's expression, not the facts it states. NLOD 2.0 § 1 limits "informasjon" to what is "beskyttet som åndsverk … eller … nærstående rettigheter i åndsverkloven kapittel 5 (deriblant databaser og fotografier)".

**NLOD 2.0 obligations on what is licensed.**
- § 5: name the licensor, refer to the licence, link where practical, and "Er informasjonen endret skal lisenstaker tydelig angi at endringer er blitt gjort av lisenstaker".
- § 6: no misleading use, and the licensor's name is not used "for å gi støtte til, for å anbefale eller for å markedsføre". "Kilder og lisens" already does both (`about.sources.processed`, `about.sources.endorsement`).

Sources:
- https://data.brreg.no/enhetsregisteret/api/docs/index.html
- https://data.brreg.no/regnskapsregisteret/regnskap/v3/api-docs
- https://data.norge.no/datasets/7c87f169-2520-4e56-ba2a-b7a3cc7de2e9
- https://www.brreg.no/bruke-data-fra-bronnoysundregistrene/apne-data/
- https://data.norge.no/nlod/no/2.0
- https://lovdata.no/dokument/NL/lov/2018-06-15-40/KAPITTEL_2 (§ 24)
- https://lovdata.no/dokument/NL/lov/2018-06-15-40/KAPITTEL_3 (§§ 33–34)
- https://lovdata.no/dokument/NL/lov/1998-07-17-56/KAPITTEL_8 (§ 8-1)

## Assessment

1. **Copyright.** A category reproduces no expression from a filing. The filed statements follow the statutory layout, and the figures in them are facts. A band of a ratio of two such facts is Peerless's own description of the company, not a copy of the document. Risk: low.
2. **Database right (§ 24).** The right covers extraction or reuse of the database's *content*. A category is not content of Regnskapsregisteret. It is computed from a handful of figures per filing, and the figures are not published outside the declared sample. Reading every 62.100 company's documents to compute categories would be a systematic extraction of figures. But what is re-used is only the categories, and it does not compete with the register's normal use: anyone can still read every filing free of charge. Risk: low, and lower than for the figures themselves, which the allow-list already confines to the sample.
3. **The register states no terms for the documents.** Nothing forbids reuse, and nothing grants it. A category asserts no licence, and "Kilder og lisens" says the register states none.
4. **What would change the assessment:** a statement from Brønnøysundregistrene that the documents may not be reused (the open question in `docs/data-sources-brreg.md`), or committing figures rather than categories outside the sample.

## Conclusion

The assessment above finds committing derived categories low risk. The gate is nevertheless **closed** (Meinich, 2026-11-25):
- an open gate changes nothing in the v1 seed (next section), so opening it buys nothing now;
- the acceptance criterion opens the gate only *if* the assessment concludes so, not that it must;
- the register states no terms for the documents, and a closed gate asserts nothing about them.

With the gate closed, `pnpm seed:export` writes fingerprint categories only for allow-listed companies, and never for a company in the labelled set (Story 5.4, decision 2). "Kilder og lisens" carries the document-figure paragraph (`about.sources.documents`) without the phrase "og for resten av bransjen bare avledede kategorier", which belongs to an open gate only. Opening the gate later is a new decision: it rewrites `docs/licence-gate.json` and this conclusion, and adds that phrase.

## What the gate changes in v1

Nothing in the seed. Outside the allow-list, the only fingerprints that exist locally belong to the labelled set's companies. AGENTS.md keeps fingerprint results for those companies out of every committed file ("no committed file or PR text ties a fingerprint result to one of them"). v1 runs no other document run (FR-3). So with either outcome, the committed seed holds fingerprints for allow-listed companies only. An open gate takes effect only when a later `pnpm ingest --documents <list>` reads companies outside both sets.
