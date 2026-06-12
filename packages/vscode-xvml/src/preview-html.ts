// Pure preview-HTML helpers — no 'vscode' imports so this module is unit-testable.
import { renderSource } from '../../../src/browser.js';

// Map a clicked href to the .xvml file name to open:
//   settings.xvml        → settings.xvml
//   settings.html        → settings.xvml
//   docs/settings.html   → settings.xvml
export function resolveNavFileName(href: string): string {
  const base = (href.split('/').pop() ?? href).trim();
  return base.endsWith('.xvml') ? base : base.replace(/\.html$/, '.xvml');
}

// Intercepts every <a href> click in the WebView and posts a 'navigate'
// message to the extension host instead of letting the WebView navigate
// (which VS Code silently blocks). External http(s) links and bare '#'
// anchors are left alone.
export function navScript(nonce: string): string {
  return `<script nonce="${nonce}">
(function(){
  var api=acquireVsCodeApi();
  document.addEventListener('click',function(e){
    var t=e.target;
    var a=t&&t.closest?t.closest('a'):null;
    if(!a)return;
    var href=a.getAttribute('href');
    if(!href||href==='#'||/^https?:\\/\\//.test(href))return;
    e.preventDefault();
    api.postMessage({type:'navigate',href:href});
  },true);
})();
</script>`;
}

// Render XVML source and prepare it for a VS Code WebView:
// - nonce on the XVML runtime <script> (WebViews block inline scripts
//   that lack a nonce matching the CSP, regardless of 'unsafe-inline')
// - CSP meta tag allowing only nonce-tagged scripts + inline styles
// - nav-intercept script before </body>
export function buildPreviewHtml(source: string, nonce: string): string {
  let html = renderSource(source);
  html = html.replace(/<script>/, `<script nonce="${nonce}">`);
  const csp =
    `<meta http-equiv="Content-Security-Policy" content=` +
    `"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">`;
  html = html.replace('<head>', `<head>\n${csp}`);
  html = html.replace('</body>', `${navScript(nonce)}\n</body>`);
  return html;
}

export function errorPage(message: string, nonce: string): string {
  const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>body{font-family:monospace;padding:1.5rem;background:#1e1e1e;color:#f48771}
h2{margin:0 0 .5rem}pre{white-space:pre-wrap;word-break:break-word}</style>
</head><body><h2>XVML parse error</h2><pre>${safe}</pre></body></html>`;
}
