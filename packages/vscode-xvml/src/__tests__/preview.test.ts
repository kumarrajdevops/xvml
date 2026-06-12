// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildPreviewHtml, navScript, resolveNavFileName } from '../preview-html.js';

const NONCE = 'testnonce123';

describe('resolveNavFileName', () => {
  it('passes .xvml hrefs through', () => {
    expect(resolveNavFileName('settings.xvml')).toBe('settings.xvml');
  });
  it('converts .html hrefs to .xvml', () => {
    expect(resolveNavFileName('settings.html')).toBe('settings.xvml');
  });
  it('strips path prefixes', () => {
    expect(resolveNavFileName('docs/noc-dashboard.html')).toBe('noc-dashboard.xvml');
    expect(resolveNavFileName('../examples/readme.xvml')).toBe('readme.xvml');
  });
});

describe('buildPreviewHtml', () => {
  const DYNAMIC_SRC = `@spec 1
@page "t" light
@data
{ "n": 1 }
@@end
@var n
`;
  const STATIC_SRC = `@spec 1
@page dashboard
@nav Home=readme.xvml | Projects=noc-dashboard.xvml | Settings=settings.xvml
@card
  @link "← Back to docs" "readme.xvml"
@end
`;

  it('adds the nonce to the XVML runtime script', () => {
    const html = buildPreviewHtml(DYNAMIC_SRC, NONCE);
    // No nonce-less <script> tags may remain — WebView would block them
    expect(html).not.toMatch(/<script>/);
    expect(html).toContain(`<script nonce="${NONCE}">`);
  });

  it('injects a CSP meta tag with the script nonce', () => {
    const html = buildPreviewHtml(STATIC_SRC, NONCE);
    expect(html).toContain(`script-src 'nonce-${NONCE}'`);
  });

  it('injects the nav-intercept script before </body>', () => {
    const html = buildPreviewHtml(STATIC_SRC, NONCE);
    expect(html).toContain('acquireVsCodeApi');
    expect(html.indexOf('acquireVsCodeApi')).toBeLessThan(html.indexOf('</body>'));
  });

  it('renders nav links as .html hrefs (renderer converts .xvml sources)', () => {
    // The renderer rewrites source-style .xvml hrefs to .html output links;
    // navigateTo maps them back to .xvml via resolveNavFileName.
    const html = buildPreviewHtml(STATIC_SRC, NONCE);
    expect(html).toContain('href="readme.html"');
    expect(html).toContain('href="noc-dashboard.html"');
    expect(html).toContain('href="settings.html"');
    expect(resolveNavFileName('noc-dashboard.html')).toBe('noc-dashboard.xvml');
  });
});

describe('nav script click interception (executed in DOM)', () => {
  const messages: Array<{ type: string; href: string }> = [];

  beforeAll(() => {
    (globalThis as Record<string, unknown>)['acquireVsCodeApi'] = () => ({
      postMessage: (m: { type: string; href: string }) => messages.push(m),
    });
    // Execute the real injected script (strip the <script> wrapper)
    const js = navScript(NONCE).replace(/<\/?script[^>]*>/g, '');
    new Function(js)();
  });

  beforeEach(() => {
    messages.length = 0;
    document.body.innerHTML = `
      <nav><ul>
        <li><a id="home" class="xvml-nav__link" href="readme.xvml">Home</a></li>
        <li><a id="proj" class="xvml-nav__link" href="noc-dashboard.xvml">Projects</a></li>
      </ul></nav>
      <a id="back" class="xvml-link" href="readme.xvml"><span id="back-span">← Back</span></a>
      <a id="ext" href="https://example.com">External</a>
      <a id="hash" href="#">Anchor</a>
    `;
  });

  function click(el: Element): MouseEvent {
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev;
  }

  it('intercepts a nav link click and posts a navigate message', () => {
    const ev = click(document.getElementById('proj')!);
    expect(messages).toEqual([{ type: 'navigate', href: 'noc-dashboard.xvml' }]);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('intercepts clicks on elements nested inside an <a> (@link content)', () => {
    click(document.getElementById('back-span')!);
    expect(messages).toEqual([{ type: 'navigate', href: 'readme.xvml' }]);
  });

  it('does not intercept external http(s) links', () => {
    const ev = click(document.getElementById('ext')!);
    expect(messages).toEqual([]);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('does not intercept bare # anchors', () => {
    click(document.getElementById('hash')!);
    expect(messages).toEqual([]);
  });

  it('ignores clicks outside any <a>', () => {
    click(document.body);
    expect(messages).toEqual([]);
  });
});
