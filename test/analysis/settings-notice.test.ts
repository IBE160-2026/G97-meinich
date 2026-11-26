// The settings notice's filled lines (Story 5.4): the invalid-settings
// notice and the median notice each on its own line, never one for the
// other. The region fills after mount (src/components/analysis/
// settings-notice.tsx); its lines are rendered here on the server.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NoticeLines } from '../../src/components/analysis/settings-notice.tsx';
import nb from '../../src/messages/nb.json' with { type: 'json' };

const lines = (show: boolean, median: boolean): string[] =>
  [...renderToString(createElement(NoticeLines, { show, median })).matchAll(/<p[^>]*>([^<]*)<\/p>/g)].map((m) => m[1] ?? '');
// renderToString escapes HTML characters; compare unescaped.
const unescape = (text: string) => text.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&');

describe('the settings notice', () => {
  it('median only: the median notice, not the invalid-settings notice', () => {
    expect(lines(false, true).map(unescape)).toEqual([nb['analysis.notice.median']]);
  });

  it('invalid only: the invalid-settings notice, not the median notice', () => {
    expect(lines(true, false).map(unescape)).toEqual([nb['analysis.notice']]);
  });

  it('both, and neither', () => {
    expect(lines(true, true).map(unescape)).toEqual([nb['analysis.notice'], nb['analysis.notice.median']]);
    expect(lines(false, false)).toEqual([]);
  });
});
