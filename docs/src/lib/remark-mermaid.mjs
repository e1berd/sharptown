import { visit } from 'unist-util-visit'

/**
 * Remark plugin: turn ```` ```mermaid ```` fenced code blocks into a raw
 * `<pre class="mermaid">` element instead of letting Shiki syntax-highlight them. The
 * diagram source is HTML-escaped, so the browser's `textContent` returns the original
 * Mermaid definition for the client-side runtime to render.
 *
 * @returns {(tree: import('mdast').Root) => void}
 */
export function remarkMermaid() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (!parent || index == null || node.lang !== 'mermaid') return
      parent.children[index] = {
        type: 'html',
        value: `<pre class="mermaid">${escapeHtml(node.value)}</pre>`,
      }
    })
  }
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
