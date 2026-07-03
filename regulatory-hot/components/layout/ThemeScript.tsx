/**
 * 主题切换：在 <head> 最早执行，避免闪烁。
 * 主题状态存于 localStorage 'reghot-theme'：'light' | 'dark' | 'system'
 */
export function ThemeScript() {
  const code = `
(function() {
  try {
    var t = localStorage.getItem('reghot-theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
  `.trim();
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
