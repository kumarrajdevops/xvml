import * as vscode from 'vscode';
import { renderSource } from '../../../src/browser.js';

// Script injected into every preview: intercepts <a> clicks and posts a
// navigate message back to the extension instead of following the href.
const NAV_SCRIPT = `<script>
(function(){
  var api = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;
  if (!api) return;
  document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href === '#' || /^https?:\\/\\//.test(href)) return;
    e.preventDefault();
    api.postMessage({ type: 'navigate', href: href });
  });
})();
</script>`;

export function activate(context: vscode.ExtensionContext): void {
  const cmd = vscode.commands.registerCommand('xvml.preview', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'xvml') {
      vscode.window.showWarningMessage('Open an .xvml file to preview it.');
      return;
    }
    XvmlPreviewPanel.createOrShow(editor.document);
  });
  context.subscriptions.push(cmd);

  // Update on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === 'xvml') XvmlPreviewPanel.update(doc);
    }),
  );

  // Update on change (debounced 400 ms) so the preview stays live while typing
  let debounce: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.languageId !== 'xvml') return;
      clearTimeout(debounce);
      debounce = setTimeout(() => XvmlPreviewPanel.update(e.document), 400);
    }),
  );
}

class XvmlPreviewPanel {
  static current: XvmlPreviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  static createOrShow(doc: vscode.TextDocument): void {
    if (XvmlPreviewPanel.current) {
      XvmlPreviewPanel.current.panel.reveal(vscode.ViewColumn.Two);
      XvmlPreviewPanel.current.render(doc);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'xvmlPreview',
      'XVML Preview',
      vscode.ViewColumn.Two,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    XvmlPreviewPanel.current = new XvmlPreviewPanel(panel, doc);
  }

  static update(doc: vscode.TextDocument): void {
    XvmlPreviewPanel.current?.render(doc);
  }

  private constructor(panel: vscode.WebviewPanel, doc: vscode.TextDocument) {
    this.panel = panel;
    this.render(doc);

    // Handle navigate messages from the WebView (link clicks in the preview)
    panel.webview.onDidReceiveMessage(
      async (msg: { type: string; href: string }) => {
        if (msg.type !== 'navigate') return;
        await this.navigateTo(msg.href);
      },
      null,
      this.disposables,
    );

    panel.onDidDispose(
      () => {
        XvmlPreviewPanel.current = undefined;
        this.dispose();
      },
      null,
      this.disposables,
    );
  }

  // Resolve an href like "settings.html" → find settings.xvml in the workspace
  // and re-render it in this panel.
  private async navigateTo(href: string): Promise<void> {
    // Strip path separators — only the basename matters
    const base = href.split('/').pop() ?? href;
    const xvmlName = base.replace(/\.html$/, '.xvml');

    const uris = await vscode.workspace.findFiles(
      `**/${xvmlName}`,
      '**/node_modules/**',
      1,
    );

    if (uris.length === 0) {
      vscode.window.showWarningMessage(`XVML preview: cannot find ${xvmlName}`);
      return;
    }

    const doc = await vscode.workspace.openTextDocument(uris[0]);
    this.render(doc);
  }

  private render(doc: vscode.TextDocument): void {
    this.panel.title = `Preview: ${doc.fileName.split('/').pop() ?? 'XVML'}`;
    try {
      let html = renderSource(doc.getText());
      // Allow the inline XVML reactive runtime
      const csp =
        `<meta http-equiv="Content-Security-Policy" ` +
        `content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">`;
      html = html.replace('<head>', `<head>\n${csp}`);
      // Inject nav-intercept script just before </body>
      html = html.replace('</body>', `${NAV_SCRIPT}\n</body>`);
      this.panel.webview.html = html;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.panel.webview.html = errorPage(msg);
    }
  }

  private dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
  }
}

function errorPage(message: string): string {
  const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>body{font-family:monospace;padding:1.5rem;background:#1e1e1e;color:#f48771}
h2{margin:0 0 .5rem}pre{white-space:pre-wrap;word-break:break-word}</style>
</head><body>
<h2>XVML parse error</h2>
<pre>${safe}</pre>
</body></html>`;
}

export function deactivate(): void {}
