import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { markdown } from '@codemirror/lang-markdown';
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import LZString from 'lz-string';
import { renderSource, ParseError } from '../../../src/browser.js';
import { EXAMPLES } from './examples.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const editorRoot = document.getElementById('editor-root')!;
const previewFrame = document.getElementById('preview-frame') as HTMLIFrameElement;
const statusDot = document.getElementById('status-dot')!;
const statusText = document.getElementById('status-text')!;
const shareBtn = document.getElementById('share-btn')!;
const openBtn = document.getElementById('open-btn')!;
const toast = document.getElementById('toast')!;
const examplesBtn = document.getElementById('examples-btn')!;
const examplesMenu = document.getElementById('examples-menu')!;

// ── Shared state ──────────────────────────────────────────────────────────────
let lastHtml = '';

// ── Render ────────────────────────────────────────────────────────────────────
let renderTimer: ReturnType<typeof setTimeout> | null = null;

function render(source: string): void {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    try {
      const html = renderSource(source);
      lastHtml = html;
      previewFrame.srcdoc = html;
      statusDot.className = 'status-dot';
      statusText.textContent = 'ok';
    } catch (err) {
      const msg = err instanceof ParseError ? err.message : String(err);
      statusDot.className = 'status-dot error';
      statusText.textContent = msg;
    }
  }, 120);
}

// ── Editor ────────────────────────────────────────────────────────────────────
function loadInitialSource(): string {
  const hash = window.location.hash.slice(1);
  if (hash) {
    try {
      const decoded = LZString.decompressFromEncodedURIComponent(hash);
      if (decoded) return decoded;
    } catch {}
  }
  return EXAMPLES[0].source;
}

const updateListener = EditorView.updateListener.of(update => {
  if (update.docChanged) {
    render(update.state.doc.toString());
  }
});

const view = new EditorView({
  state: EditorState.create({
    doc: loadInitialSource(),
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      bracketMatching(),
      foldGutter(),
      indentOnInput(),
      markdown(),
      oneDark,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      updateListener,
      EditorView.theme({
        '&': { height: '100%', background: '#0d1117' },
        '.cm-scroller': { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' },
        '.cm-gutters': { background: '#0d1117', borderRight: '1px solid #2a2d3a' },
      }),
    ],
  }),
  parent: editorRoot,
});

// Initial render
render(view.state.doc.toString());

// ── Share ─────────────────────────────────────────────────────────────────────
shareBtn.addEventListener('click', () => {
  const source = view.state.doc.toString();
  const compressed = LZString.compressToEncodedURIComponent(source);
  const url = `${window.location.origin}${window.location.pathname}#${compressed}`;
  navigator.clipboard.writeText(url).then(() => {
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  });
});

// ── Open in new tab ───────────────────────────────────────────────────────────
openBtn.addEventListener('click', () => {
  if (!lastHtml) return;
  const blob = new Blob([lastHtml], { type: 'text/html' });
  window.open(URL.createObjectURL(blob), '_blank');
});

// ── Examples menu ─────────────────────────────────────────────────────────────
EXAMPLES.forEach(ex => {
  const item = document.createElement('div');
  item.className = 'example-item';
  item.innerHTML = `${ex.name}<small>${ex.description}</small>`;
  item.addEventListener('click', () => {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: ex.source },
    });
    examplesMenu.classList.remove('open');
    history();
  });
  examplesMenu.appendChild(item);
});

examplesBtn.addEventListener('click', e => {
  e.stopPropagation();
  examplesMenu.classList.toggle('open');
});
document.addEventListener('click', () => examplesMenu.classList.remove('open'));
