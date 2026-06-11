import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import { XVML_RUNTIME } from '../runtime.js';

interface XvmlApi {
  state: Record<string, unknown>;
  set(key: string, value: unknown): void;
  get(key: string): unknown;
  init(data: Record<string, unknown>): void;
}

function boot(bodyHtml: string, initialState: Record<string, unknown>) {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = bodyHtml;
  const fn = new Function('window', 'document', `${XVML_RUNTIME}`);
  fn(window, document);
  const xvml = (window as unknown as { xvml: XvmlApi }).xvml;
  xvml.init(initialState);
  return { document, xvml };
}

describe('runtime — @if', () => {
  it('shows element when state key is truthy, hides when falsy', () => {
    const { document, xvml } = boot(
      '<div data-xi="loggedIn" style="display:none">hi</div>',
      { loggedIn: true },
    );
    const el = document.querySelector('[data-xi]')!;
    expect(el.style.display).toBe('');
    xvml.set('loggedIn', false);
    expect(el.style.display).toBe('none');
  });

  it('negated condition inverts visibility', () => {
    const { document, xvml } = boot(
      '<div data-xi="!loggedIn" style="display:none">guest</div>',
      { loggedIn: false },
    );
    const el = document.querySelector('[data-xi]')!;
    expect(el.style.display).toBe('');
    xvml.set('loggedIn', true);
    expect(el.style.display).toBe('none');
  });

  it('resolves dot-path conditions against nested state', () => {
    const { document, xvml } = boot(
      '<div data-xi="user.active" style="display:none">active</div>',
      { user: { active: true } },
    );
    const el = document.querySelector('[data-xi]')!;
    expect(el.style.display).toBe('');
    xvml.set('user.active', false);
    expect(el.style.display).toBe('none');
  });
});

describe('runtime — @var', () => {
  it('renders flat and dot-path state values as text', () => {
    const { document, xvml } = boot(
      '<span data-xv="name"></span><span data-xv="user.role"></span>',
      { name: 'Alex', user: { role: 'admin' } },
    );
    const [flat, nested] = Array.from(document.querySelectorAll('[data-xv]'));
    expect(flat.textContent).toBe('Alex');
    expect(nested.textContent).toBe('admin');
    xvml.set('user.role', 'viewer');
    expect(nested.textContent).toBe('viewer');
  });
});

describe('runtime — set/get', () => {
  it('set with dot path creates intermediate objects', () => {
    const { xvml } = boot('<div></div>', {});
    xvml.set('a.b.c', 42);
    expect(xvml.get('a.b.c')).toBe(42);
    expect(xvml.get('a.b')).toEqual({ c: 42 });
  });

  it('toggle pattern works via set(!get())', () => {
    const { xvml } = boot('<div></div>', { darkMode: false });
    xvml.set('darkMode', !xvml.get('darkMode'));
    expect(xvml.get('darkMode')).toBe(true);
  });
});

describe('runtime — @each', () => {
  it('clones template per array item and resolves item paths', () => {
    const { document, xvml } = boot(
      '<div data-xe="items" data-xei="item">' +
        '<template><span data-xv="item.label"></span></template>' +
        '<div data-xec></div>' +
        '</div>',
      { items: [{ label: 'First' }, { label: 'Second' }] },
    );
    const labels = Array.from(document.querySelectorAll('[data-xec] [data-xv]')).map(n => n.textContent);
    expect(labels).toEqual(['First', 'Second']);
    xvml.set('items', [{ label: 'Only' }]);
    const after = Array.from(document.querySelectorAll('[data-xec] [data-xv]')).map(n => n.textContent);
    expect(after).toEqual(['Only']);
  });
});

describe('runtime — @each with string arrays', () => {
  it('resolves the bare item name to the array element', () => {
    const { document, xvml } = boot(
      '<div data-xe="tags" data-xei="tag">' +
        '<template><span class="xvml-badge"><span data-xv="tag"></span></span></template>' +
        '<div data-xec></div>' +
        '</div>',
      { tags: ['CLI', 'XVML', 'AI'] },
    );
    const texts = Array.from(document.querySelectorAll('[data-xec] [data-xv]')).map(n => n.textContent);
    expect(texts).toEqual(['CLI', 'XVML', 'AI']);
    xvml.set('tags', ['one']);
    expect(Array.from(document.querySelectorAll('[data-xec] [data-xv]')).map(n => n.textContent)).toEqual(['one']);
  });
});
