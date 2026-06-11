import { describe, it, expect } from 'vitest';
import { renderSource } from '../renderer.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../../');

async function render(xvml: string): Promise<string> {
  return renderSource(xvml, path.join(SRC, 'test.xvml'));
}

describe('renderer — document structure', () => {
  it('emits a complete HTML document', async () => {
    const html = await render('@page "Test Page"\n@card\n  @text "Hello"\n@end');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Test Page</title>');
    expect(html).toContain('</html>');
  });

  it('inlines all CSS in a <style> block', async () => {
    const html = await render('@page test\n@card\n  @text "Hi"\n@end');
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/href="https?:/);
    expect(html).not.toMatch(/src="https?:/);
  });

  it('applies explicit dark theme class', async () => {
    const html = await render('@page "App" dark\n@card\n  @text "Hi"\n@end');
    expect(html).toContain('xvml-theme-dark');
  });

  it('applies no theme class to <body> when theme is omitted (uses prefers-color-scheme)', async () => {
    const html = await render('@page test\n@card\n  @text "Hi"\n@end');
    const bodyLine = html.split('\n').find(l => l.includes('<body'));
    expect(bodyLine).not.toContain('xvml-theme-');
  });

  it('renders @meta tags into <head>', async () => {
    const html = await render('@meta "description" "My page"\n@page test\n@card\n  @text "Hi"\n@end');
    expect(html).toContain('<meta name="description" content="My page"');
  });
});

describe('renderer — determinism', () => {
  it('produces byte-identical output on two renders of the same input', async () => {
    const xvml = '@page "Dashboard"\n@card "Stats"\n  @stat "99%" "Uptime" up\n  @progress "CPU" 45 100 success\n@end';
    const a = await render(xvml);
    const b = await render(xvml);
    expect(a).toBe(b);
  });

  it('different inputs produce different output', async () => {
    const a = await render('@page "Page A"\n@card\n  @text "Hello A"\n@end');
    const b = await render('@page "Page B"\n@card\n  @text "Hello B"\n@end');
    expect(a).not.toBe(b);
  });
});

describe('renderer — @card', () => {
  it('renders card with label', async () => {
    const html = await render('@page test\n@card "My Card"\n  @text "content"\n@end');
    expect(html).toContain('class="xvml-card"');
    expect(html).toContain('<h2 class="xvml-card__label">My Card</h2>');
  });

  it('renders flat modifier', async () => {
    const html = await render('@page test\n@card flat\n  @text "content"\n@end');
    expect(html).toContain('xvml-card--flat');
  });
});

describe('renderer — content commands', () => {
  it('@title renders h1 with size class', async () => {
    const html = await render('@page test\n@card\n  @title "Hello" xl\n@end');
    expect(html).toContain('<h1 class="xvml-title xvml-title--xl">Hello</h1>');
  });

  it('@subtitle renders p with muted modifier', async () => {
    const html = await render('@page test\n@card\n  @subtitle "Sub" muted\n@end');
    expect(html).toContain('class="xvml-subtitle xvml-subtitle--muted"');
    expect(html).toContain('Sub');
  });

  it('@badge renders with variant', async () => {
    const html = await render('@page test\n@card\n  @badge "Active" success\n@end');
    expect(html).toContain('class="xvml-badge xvml-badge--success"');
    expect(html).toContain('Active');
  });

  it('@divider with text renders line-text-line pattern', async () => {
    const html = await render('@page test\n@card\n  @divider "or"\n@end');
    expect(html).toContain('xvml-divider--text');
    expect(html).toContain('or');
  });

  it('@alert variant comes before message', async () => {
    const html = await render('@page test\n@card\n  @alert warn "Watch out"\n@end');
    expect(html).toContain('xvml-alert--warning');
    expect(html).toContain('Watch out');
  });

  it('@alert error variant', async () => {
    const html = await render('@page test\n@card\n  @alert error "Fail"\n@end');
    expect(html).toContain('xvml-alert--error');
  });
});

describe('renderer — form commands', () => {
  it('@field renders label + input with correct type', async () => {
    const html = await render('@page test\n@card\n  @field email "Email address"\n@end');
    expect(html).toContain('type="email"');
    expect(html).toContain('Email address');
  });

  it('@field secret renders password type', async () => {
    const html = await render('@page test\n@card\n  @field password "Password" secret\n@end');
    expect(html).toContain('type="password"');
  });

  it('@field with value= renders default value', async () => {
    const html = await render('@page test\n@card\n  @field text "Name" value="Kumar"\n@end');
    expect(html).toContain('value="Kumar"');
  });

  it('@field required adds required attribute', async () => {
    const html = await render('@page test\n@card\n  @field email "Email" required\n@end');
    expect(html).toContain('required');
  });

  it('@button renders with variant class', async () => {
    const html = await render('@page test\n@card\n  @button "Save" primary\n@end');
    expect(html).toContain('xvml-button--primary');
    expect(html).toContain('Save');
  });

  it('@button disabled renders disabled attribute', async () => {
    const html = await render('@page test\n@card\n  @button "Save" disabled\n@end');
    expect(html).toContain('disabled');
  });

  it('@select renders options from pipe-delimited string', async () => {
    const html = await render('@page test\n@card\n  @select "Team" "Incident | Platform | Cloud"\n@end');
    expect(html).toContain('<option');
    expect(html).toContain('Incident');
    expect(html).toContain('Platform');
    expect(html).toContain('Cloud');
  });

  it('@checkbox renders checked state', async () => {
    const html = await render('@page test\n@card\n  @checkbox "Remember me" checked\n@end');
    expect(html).toContain('checked');
    expect(html).toContain('Remember me');
  });
});

describe('renderer — data commands', () => {
  it('@stat renders value then label', async () => {
    const html = await render('@page test\n@card\n  @stat "1,024" "Total users" up\n@end');
    expect(html).toContain('xvml-stat__value');
    expect(html).toContain('1,024');
    expect(html).toContain('Total users');
    expect(html).toContain('xvml-stat__trend--up');
  });

  it('@progress renders fill width as percentage', async () => {
    const html = await render('@page test\n@card\n  @progress "Storage" 75 100 warning\n@end');
    expect(html).toContain('width:75%');
    expect(html).toContain('xvml-progress__fill--warning');
  });

  it('@table first @row becomes thead', async () => {
    const html = await render('@page test\n@card\n  @table striped\n    @row "Name" "Role"\n    @row "Alice" "Admin"\n  @end\n@end');
    expect(html).toContain('<thead>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('<td>Alice</td>');
    expect(html).toContain('xvml-table--striped');
  });

  it('@list check renders with check modifier', async () => {
    const html = await render('@page test\n@card\n  @list check\n    @item "Do this"\n  @end\n@end');
    expect(html).toContain('xvml-list--check');
    expect(html).toContain('Do this');
  });
});

describe('renderer — layout commands', () => {
  it('@cols renders grid container', async () => {
    const html = await render('@page test\n@card\n  @cols 3\n    @stat "1" "A"\n    @stat "2" "B"\n    @stat "3" "C"\n  @end\n@end');
    expect(html).toContain('xvml-cols--3');
    expect(html).toContain('xvml-col');
  });

  it('@layout inline wraps siblings in flex container', async () => {
    const html = await render('@page test\n@card\n  @layout inline\n  @button "A"\n  @button "B"\n@end');
    expect(html).toContain('xvml-layout--inline');
  });

  it('@nav renders links from pipe-separated keywords', async () => {
    const html = await render('@page test\n@nav Home | Projects | Settings\n@card\n  @text "Hi"\n@end');
    expect(html).toContain('xvml-nav');
    expect(html).toContain('Home');
    expect(html).toContain('Projects');
    expect(html).toContain('Settings');
  });

  it('@avatar renders initials', async () => {
    const html = await render('@page test\n@card\n  @avatar "KS"\n@end');
    expect(html).toContain('xvml-avatar');
    expect(html).toContain('KS');
  });
});

describe('renderer — codeblock', () => {
  it('@codeblock renders raw content escaped', async () => {
    const xvml = '@page test\n@card\n  @codeblock ts\nconst x = <string>;\n  @@end\n@end';
    const html = await render(xvml);
    expect(html).toContain('language-ts');
    expect(html).toContain('&lt;string&gt;');
  });

  it('@codeblock with @end inside renders @end as content', async () => {
    const xvml = '@page test\n@card\n  @codeblock xvml\n@card\n  @title "Hi"\n@end\n  @@end\n@end';
    const html = await render(xvml);
    expect(html).toContain('@end');
  });
});

describe('renderer — HTML escaping', () => {
  it('escapes special characters in strings', async () => {
    const html = await render('@page test\n@card\n  @title "<script>alert(1)</script>"\n@end');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes ampersands', async () => {
    const html = await render('@page test\n@card\n  @text "A & B"\n@end');
    expect(html).toContain('A &amp; B');
  });
});

describe('renderer — dynamic commands', () => {
  it('@if renders a hidden block with data-xi attribute', async () => {
    const html = await render('@page test\n@if isAdmin\n  @text "Admin"\n@end');
    expect(html).toContain('data-xi="isAdmin"');
    expect(html).toContain('display:none');
  });

  it('@if with negation renders data-xi="!var"', async () => {
    const html = await render('@page test\n@if !loggedIn\n  @button "Sign in" primary\n@end');
    expect(html).toContain('data-xi="!loggedIn"');
  });

  it('@each renders template and items container', async () => {
    const html = await render('@page test\n@each tag in tags\n  @badge tag\n@end');
    expect(html).toContain('data-xe="tags"');
    expect(html).toContain('data-xei="tag"');
    expect(html).toContain('<template>');
    expect(html).toContain('data-xec');
  });

  it('@bind renders a bound input with oninput handler', async () => {
    const html = await render('@page test\n@bind name "Full name" text');
    expect(html).toContain('data-xb="name"');
    expect(html).toContain("xvml.set('name'");
  });

  it('@var renders a span with data-xv attribute', async () => {
    const html = await render('@page test\n@var username');
    expect(html).toContain('data-xv="username"');
  });

  it('@data injects initial state and runtime script', async () => {
    const src = '@page test\n@data\n{"count":42,"name":"Alex"}\n@@end\n@var name';
    const html = await render(src);
    expect(html).toContain('xvml.init(');
    expect(html).toContain('"count":42');
    expect(html).toContain('"name":"Alex"');
  });

  it('no runtime script when no dynamic commands used', async () => {
    const html = await render('@page test\n@card\n  @text "hello"\n@end');
    expect(html).not.toContain('xvml.init(');
    expect(html).not.toContain('data-xi');
  });
});
