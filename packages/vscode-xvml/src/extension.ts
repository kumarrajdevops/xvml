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
  // The file currently shown — nav links resolve relative to its directory
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
    const xvmlName = resolveNavFileName(href);

    // 1. Sibling of the currently-shown file (most common case).
    //    NB: vscode.Uri.joinPath does not resolve '..' — use path.dirname.
    if (this.currentUri) {
      const sibling = vscode.Uri.file(
        path.join(path.dirname(this.currentUri.fsPath), xvmlName),
      );
      try {
        const doc = await vscode.workspace.openTextDocument(sibling);
        this.render(doc);
        return;
      } catch { /* not there, fall through */ }
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
    const nonce = getNonce();
    try {
      this.panel.webview.html = buildPreviewHtml(doc.getText(), nonce);
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
