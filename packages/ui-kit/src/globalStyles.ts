/** Base CSS (resets, scrollbar, keyframes) shared by every frontend shell. */
export const GLOBAL_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;width:100%}
body{font-family:"IBM Plex Sans",sans-serif;background:#080808;color:#F0F0F0;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
::-webkit-scrollbar-thumb:hover{background:#555}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 currentColor}50%{opacity:.5;box-shadow:0 0 6px 2px currentColor}}
`;
