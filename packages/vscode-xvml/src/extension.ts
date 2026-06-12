import * as vscode from 'vscode';
import * as path from 'path';
import { renderSource } from '../../../src/browser.js';

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

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === 'xvml') XvmlPreviewPanel.update(doc);
    }),
  );

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
  private currentUri: vscode.Uri | undefined;

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

    panel.webview.onDidReceiveMessage(
      async (msg: { type: string; href: string }) => {
        if (msg.type === 'navigate') await this.navigateTo(msg.href);
      },
      null,
      this.disposables,
    );

    panel.onDidDispose(
      () => { XvmlPreviewPanel.current = undefined; this.dispose(); },
      null,
      this.disposables,
    );
  }

  private async navigateTo(href: string): Promise<void> {
    const base = (href.split('/').pop() ?? href).trim();
    const xvmlName = base.endsWith('.xvml') ? base : base.replace(/\.html$/, '.xvml');

    // 1. Sibling of the currently-shown file (most common case)
    if (this.currentUri) {
      const sibling = vscode.Uri.file(
        path.join(path.dirname(this.currentUri.fsPath), xvmlName),
      );
      try {
        const doc = await vscode.workspace.openTextDocument(sibling);
        this.render(doc);
        return;
      } catch { /* not there */ }
    }

    // 2. Workspace-wide search
    const found = await vscode.workspace.findFiles(`**/${xvmlName}`, '**/node_modules/**', 1);
    if (found.length > 0) {
      const doc = await vscode.workspace.openTextDocument(found[0]);
      this.render(doc);
      return;
    }

    vscode.window.showWarningMessage(`XVML preview: cannot find ${xvmlName}`);
  }

  private render(doc: vscode.TextDocument): void {
    this.currentUri = doc.uri;
    this.panel.title = `Preview ─ ${path.basename(doc.fileName)}`;

    // VS Code WebViews require a per-render nonce on every inline <script>.
    // 'unsafe-inline' alone is not enough — VS Code's iframe sandbox blocks it.
    const nonce = getNonce();

    try {
      let html = renderSource(doc.getText());

      // Add nonce to the XVML reactive runtime script (the one <script> the
      // renderer emits). Pages with no dynamic commands have no <script> tag;
      // the replace is a no-op in that case.
      html = html.replace(/<script>/, `<script nonce="${nonce}">`);

      // Inject CSP: nonce for scripts, unsafe-inline for the inlined BASE_CSS.
      const csp =
        `<meta http-equiv="Content-Security-Policy" content=` +
        `"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">`;
      html = html.replace('<head>', `<head>\n${csp}`);

      // Inject the nav-intercept script (also nonce-tagged) just before </body>.
      html = html.replace('</body>', `${navScript(nonce)}\n</body>`);

      this.panel.webview.html = html;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.panel.webview.html = errorPage(msg, nonce);
    }
  }

  private dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
  }
}

// Random 32-char alphanumeric string — must be fresh every render call.
function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let n = '';
  for (let i = 0; i < 32; i++) n += chars[Math.floor(Math.random() * chars.length)];
  return n;
}

// Intercepts every <a href> click in the WebView and posts a 'navigate'
// message to the extension host instead of following the href.
function navScript(nonce: string): string {
  return `<script nonce="${nonce}">
(function(){
  var api=acquireVsCodeApi();
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest('a');
    if(!a)return;
    var href=a.getAttribute('href');
    if(!href||href==='#'||/^https?:\\/\\//.test(href))return;
    e.preventDefault();
    api.postMessage({type:'navigate',href:href});
  },true);
})();
</script>`;
}

function errorPage(message: string, nonce: string): string {
  const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>body{font-family:monospace;padding:1.5rem;background:#1e1e1e;color:#f48771}
h2{margin:0 0 .5rem}pre{white-space:pre-wrap;word-break:break-word}</style>
</head><body><h2>XVML parse error</h2><pre>${safe}</pre></body></html>`;
}

export function deactivate(): void {}
