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

describe('runtime — @if comparisons', () => {
  it('evaluates numeric comparisons live', () => {
    const { document, xvml } = boot(
      '<div data-xi="count > 0" style="display:none">items</div>',
      { count: 0 },
    );
    const el = document.querySelector('[data-xi]')!;
    expect(el.style.display).toBe('none');
    xvml.set('count', 3);
    expect(el.style.display).toBe('');
  });

  it('evaluates string equality and negated groups', () => {
    const { document, xvml } = boot(
      '<div data-xi="user.role == \'admin\'" style="display:none">admin</div>' +
      '<div data-xi="!(user.role == \'admin\')" style="display:none">other</div>',
      { user: { role: 'admin' } },
    );
    const [adm, oth] = Array.from(document.querySelectorAll('[data-xi]'));
    expect(adm.style.display).toBe('');
    expect(oth.style.display).toBe('none');
    xvml.set('user.role', 'viewer');
    expect(adm.style.display).toBe('none');
    expect(oth.style.display).toBe('');
  });
});

describe('runtime — nested @each', () => {
  it('rebuilds inner loops with item-scoped collections', () => {
    const { document, xvml } = boot(
      '<div data-xe="teams" data-xei="team">' +
        '<template><b data-xv="team.name"></b>' +
        '<div data-xe="team.members" data-xei="member">' +
        '<template><span data-xv="member"></span></template>' +
        '<div data-xec></div></div></template>' +
        '<div data-xec></div>' +
        '</div>',
      { teams: [{ name: 'Core', members: ['Ann', 'Bo'] }, { name: 'Ops', members: ['Cy'] }] },
    );
    const names = Array.from(document.querySelectorAll('[data-xv="team.name"]')).map(n => n.textContent);
    const members = Array.from(document.querySelectorAll('[data-xv="member"]')).map(n => n.textContent);
    expect(names).toEqual(['Core', 'Ops']);
    expect(members).toEqual(['Ann', 'Bo', 'Cy']);
    xvml.set('teams', [{ name: 'Solo', members: ['Zed'] }]);
    expect(Array.from(document.querySelectorAll('[data-xv="member"]')).map(n => n.textContent)).toEqual(['Zed']);
  });
});

describe('runtime — per-item handlers and index', () => {
  it('interpolates {item__index} into cloned onclick handlers', () => {
    const { document } = boot(
      '<div data-xe="items" data-xei="item">' +
        '<template><button onclick="xvml.removeAt(\'items\',{item__index})">x</button></template>' +
        '<div data-xec></div>' +
        '</div>',
      { items: ['a', 'b'] },
    );
    const handlers = Array.from(document.querySelectorAll('[data-xec] button')).map(b => b.getAttribute('onclick'));
    expect(handlers).toEqual([
      "xvml.removeAt('items',0)",
      "xvml.removeAt('items',1)",
    ]);
  });

  it('resolves item__index as a renderable value', () => {
    const { document } = boot(
      '<div data-xe="items" data-xei="item">' +
        '<template><span data-xv="item__index"></span></template>' +
        '<div data-xec></div>' +
        '</div>',
      { items: ['a', 'b'] },
    );
    const idx = Array.from(document.querySelectorAll('[data-xec] [data-xv]')).map(n => n.textContent);
    expect(idx).toEqual(['0', '1']);
  });
});

describe('runtime — push / removeAt', () => {
  it('push appends and re-renders, removeAt deletes by index', () => {
    const { document, xvml } = boot(
      '<div data-xe="items" data-xei="item">' +
        '<template><span data-xv="item"></span></template>' +
        '<div data-xec></div>' +
        '</div>',
      { items: ['a'] },
    );
    const api = xvml as unknown as { push(k: string, v: unknown): void; removeAt(k: string, i: number): void };
    api.push('items', 'b');
    expect(Array.from(document.querySelectorAll('[data-xec] [data-xv]')).map(n => n.textContent)).toEqual(['a', 'b']);
    api.removeAt('items', 0);
    expect(Array.from(document.querySelectorAll('[data-xec] [data-xv]')).map(n => n.textContent)).toEqual(['b']);
  });
});

describe('runtime — attribute binding (data-xattr)', () => {
  it('sets, removes, and re-applies bound attributes on state change', () => {
    const { document, xvml } = boot(
      '<button data-xattr="disabled:busy">Go</button>',
      { busy: true },
    );
    const el = document.querySelector('button')!;
    expect(el.hasAttribute('disabled')).toBe(true);
    xvml.set('busy', false);
    expect(el.hasAttribute('disabled')).toBe(false);
  });

  it('appends a bound class to the base class list', () => {
    const { document, xvml } = boot(
      '<span class="xvml-badge" data-xattr="class:mode">x</span>',
      { mode: 'xvml-badge--success' },
    );
    const el = document.querySelector('span')!;
    expect(el.className).toBe('xvml-badge xvml-badge--success');
    xvml.set('mode', '');
    expect(el.className).toBe('xvml-badge');
  });
});

describe('runtime — checkbox binding (data-xb)', () => {
  it('syncs checkbox checked from boolean state', () => {
    const { document, xvml } = boot(
      '<input type="checkbox" data-xb="dark" />',
      { dark: true },
    );
    const el = document.querySelector('input') as unknown as { checked: boolean };
    expect(el.checked).toBe(true);
    xvml.set('dark', false);
    expect(el.checked).toBe(false);
  });
});

describe('runtime — negated attribute binding', () => {
  it('supports a leading ! on the bound path', () => {
    const { document, xvml } = boot(
      '<button data-xattr="disabled:!loggedIn">Members</button>',
      { loggedIn: false },
    );
    const el = document.querySelector('button')!;
    expect(el.hasAttribute('disabled')).toBe(true);
    xvml.set('loggedIn', true);
    expect(el.hasAttribute('disabled')).toBe(false);
  });
});

describe('runtime — loop rebuild vs focus', () => {
  const LOOP =
    '<div data-xe="items" data-xei="item">' +
    '<template><input type="text" /><button onclick="xvml.removeAt(\'items\',{item__index})">x</button></template>' +
    '<div data-xec></div>' +
    '</div>';

  it('rebuilds the loop when a button inside it has focus (per-item remove)', () => {
    const { document, xvml } = boot(LOOP, { items: ['a', 'b'] });
    const api = xvml as unknown as { removeAt(k: string, i: number): void };
    (document.querySelectorAll('[data-xec] button')[0] as unknown as { focus(): void }).focus();
    api.removeAt('items', 0);
    expect(document.querySelectorAll('[data-xec] button').length).toBe(1);
    expect(document.querySelectorAll('[data-xec] button')[0].getAttribute('onclick'))
      .toBe("xvml.removeAt('items',0)");
  });

  it('still defers rebuild while a text input inside the loop has focus', () => {
    const { document, xvml } = boot(LOOP, { items: ['a', 'b'] });
    (document.querySelectorAll('[data-xec] input')[0] as unknown as { focus(): void }).focus();
    xvml.set('items', ['a', 'b', 'c']);
    expect(document.querySelectorAll('[data-xec] button').length).toBe(2);
  });
});

describe('runtime — item-scoped @bind (edit in place)', () => {
  it('interpolates the write path per item and set() updates the array element', () => {
    const { document, xvml } = boot(
      '<div data-xe="todos" data-xei="todo">' +
        '<template><input type="text" data-xb="todo" oninput="xvml.set(\'todos.{todo__index}\',this.value)" /></template>' +
        '<div data-xec></div>' +
        '</div>',
      { todos: ['first', 'second'] },
    );
    const inputs = Array.from(document.querySelectorAll('[data-xec] input'));
    // read side: each input shows its own item
    expect(inputs.map(i => (i as unknown as { value: string }).value)).toEqual(['first', 'second']);
    // write side: handler was interpolated with this item's index
    expect(inputs.map(i => i.getAttribute('oninput'))).toEqual([
      "xvml.set('todos.0',this.value)",
      "xvml.set('todos.1',this.value)",
    ]);
    // simulate the second input's handler firing
    xvml.set('todos.1', 'edited');
    expect(xvml.get('todos')).toEqual(['first', 'edited']);
  });
});
