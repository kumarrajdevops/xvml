import * as vscode from 'vscode';
import * as path from 'path';
import { buildPreviewHtml, errorPage, resolveNavFileName } from './preview-html.js';

export function activate(context: vscode.ExtensionContext): void {
  const cmd = vscode.commands.registerCommand('xvml.preview', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'xvml') {
      vscode.window.showWarningMessage('Open an .xvml file to preview it.');
      return;
    }
    XvmlPreviewPanel.createOrShow(editor.document.uri);
  });
  context.subscriptions.push(cmd);

  // Live update, three sources — all routed through refreshIfCurrent so only
  // the file actually being previewed triggers a re-render:
  // 1. typing in the editor (debounced 400 ms, includes unsaved changes)
  let debounce: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.languageId !== 'xvml') return;
      clearTimeout(debounce);
      debounce = setTimeout(() => XvmlPreviewPanel.refreshIfCurrent(e.document.uri), 400);
    }),
  );
  // 2. saving in the editor
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === 'xvml') XvmlPreviewPanel.refreshIfCurrent(doc.uri);
    }),
  );
  // 3. the file changing on disk outside the editor (git, CLI, AI agents)
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.xvml');
  context.subscriptions.push(
    watcher,
    watcher.onDidChange(uri => XvmlPreviewPanel.refreshIfCurrent(uri)),
    watcher.onDidCreate(uri => XvmlPreviewPanel.refreshIfCurrent(uri)),
  );
}

// Freshest content for a file: the live editor buffer when the file is open
// (covers unsaved edits), otherwise straight from disk (covers external
// changes that VS Code's TextDocument cache may not have picked up yet).
async function loadText(uri: vscode.Uri): Promise<string> {
  const open = vscode.workspace.textDocuments.find(d => d.uri.fsPath === uri.fsPath);
  if (open) return open.getText();
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString('utf8');
}

class XvmlPreviewPanel {
  static current: XvmlPreviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  // The file currently shown — nav links resolve relative to its directory
  private currentUri: vscode.Uri | undefined;

  static createOrShow(uri: vscode.Uri): void {
    if (XvmlPreviewPanel.current) {
      XvmlPreviewPanel.current.panel.reveal(vscode.ViewColumn.Two);
      void XvmlPreviewPanel.current.show(uri);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'xvmlPreview',
      'XVML Preview',
      vscode.ViewColumn.Two,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    XvmlPreviewPanel.current = new XvmlPreviewPanel(panel, uri);
  }

  // Re-render only when the changed file is the one being previewed.
  static refreshIfCurrent(uri: vscode.Uri): void {
    const cur = XvmlPreviewPanel.current;
    if (cur?.currentUri && cur.currentUri.fsPath === uri.fsPath) {
      void cur.show(uri);
    }
  }

  private constructor(panel: vscode.WebviewPanel, uri: vscode.Uri) {
    this.panel = panel;
    void this.show(uri);

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
    const xvmlName = resolveNavFileName(href);

    // 1. Sibling of the currently-shown file (most common case).
    //    NB: vscode.Uri.joinPath does not resolve '..' — use path.dirname.
    if (this.currentUri) {
      const sibling = vscode.Uri.file(
        path.join(path.dirname(this.currentUri.fsPath), xvmlName),
      );
      try {
        await this.show(sibling);
        return;
      } catch { /* not there, fall through */ }
    }

    // 2. Workspace-wide search
    const found = await vscode.workspace.findFiles(`**/${xvmlName}`, '**/node_modules/**', 1);
    if (found.length > 0) {
      await this.show(found[0]);
      return;
    }

    vscode.window.showWarningMessage(`XVML preview: cannot find ${xvmlName}`);
  }

  // Load the freshest content for the file and render it.
  // Throws if the file doesn't exist (navigateTo relies on that).
  private async show(uri: vscode.Uri): Promise<void> {
    const text = await loadText(uri);
    this.currentUri = uri;
    this.panel.title = `Preview ─ ${path.basename(uri.fsPath)}`;
    const nonce = getNonce();
    try {
      this.panel.webview.html = buildPreviewHtml(text, nonce);
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

// Fresh random nonce per render — required by the WebView CSP.
function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let n = '';
  for (let i = 0; i < 32; i++) n += chars[Math.floor(Math.random() * chars.length)];
  return n;
}

export function deactivate(): void {}
