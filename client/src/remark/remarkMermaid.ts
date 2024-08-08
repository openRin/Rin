import type { Plugin } from 'unified';
import type { Content, Root } from 'mdast';

function processNode(child: Content, index: number, siblings: Content[]) {
  if (child.type !== 'code') {
    if ('children' in child) {
      child.children.map(processNode);
    }
    return;
  }
  const { lang, value } = child;
  if (lang !== 'mermaid') return;
  siblings[index] = {
    type: 'html',
    value: `
    <pre class="mermaid_default dark:hidden">${value}</pre>
    <pre class="mermaid_dark dark:block hidden">${value}</pre>
    `
  }
}

const remarkMermaid: Plugin<[], Root> = () => (root: Root) => {
  root.children.map(processNode)
};

export default remarkMermaid;
