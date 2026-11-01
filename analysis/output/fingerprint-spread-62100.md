# Within-band spread, 62.100

Story 2.5 (D3; FR-13). Written by `pnpm analysis:spread` (scripts/fingerprint-spread.ts); do not edit.

Each 62.100 company with a stored fingerprint, at its newest fingerprinted year: 421 companies. Only shares that were read count; an empty cost line gives no share. The test (test/fingerprint-spread.test.ts) asserts that in every band with n ≥ 10 the interquartile range is at least 2 percentage points; a band below n 10 is reported only.

The fingerprints rest on the Story 2.1b acceptance run, local data until Story 5.4.

## Cost of goods share (varekostnad / sum_driftsinntekter)

| Band | n | IQR |
|---|---:|---:|
| low | 83 | 5,0 pp |
| mid | 134 | 11,6 pp |
| high | 80 | 29,8 pp |

## Personnel cost share (lonnskostnad / sum_driftsinntekter)

| Band | n | IQR |
|---|---:|---:|
| low | 87 | 15,4 pp |
| mid | 127 | 15,0 pp |
| high | 92 | 19,9 pp |
