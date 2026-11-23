/**
 * Prints one element and nothing else: it is moved to the top of <body> for the print (a dialog or scroll
 * area would clip or offset it), where index.css hides its siblings, then put back where React left it.
 * In the light theme whatever the app is in: dark-theme text is near white, and paper is white.
 */
export function printSheet(node: HTMLElement, onDone?: () => void) {
  const parent = node.parentElement!;
  const anchor = node.nextSibling;
  const html = document.documentElement;
  const dark = html.classList.contains("dark");
  const restore = () => {
    window.removeEventListener("afterprint", restore);
    delete node.dataset.printing;
    if (dark) html.classList.add("dark");
    parent.insertBefore(node, anchor?.parentNode === parent ? anchor : null);
    onDone?.();
  };
  node.dataset.printing = "";
  html.classList.remove("dark");
  document.body.appendChild(node);
  window.addEventListener("afterprint", restore);
  window.print();
}
