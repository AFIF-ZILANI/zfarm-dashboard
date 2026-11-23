/**
 * Prints one element and nothing else: it is moved to the top of <body> for the print (a dialog or scroll
 * area would clip or offset it), where index.css hides its siblings, then put back where React left it.
 */
export function printSheet(node: HTMLElement, onDone?: () => void) {
  const parent = node.parentElement!;
  const anchor = node.nextSibling;
  const restore = () => {
    window.removeEventListener("afterprint", restore);
    delete node.dataset.printing;
    parent.insertBefore(node, anchor?.parentNode === parent ? anchor : null);
    onDone?.();
  };
  node.dataset.printing = "";
  document.body.appendChild(node);
  window.addEventListener("afterprint", restore);
  window.print();
}
