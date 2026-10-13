import type { Root } from "hast";
import { toString as hastToString } from 'hast-util-to-string';
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

declare global {
  var exampleBlockMap: Map<string, string>;
}

global.exampleBlockMap = global.exampleBlockMap || new Map<string, string>();



export const rehypeExampleBlockTransformerPre: Plugin<[], Root> = () => {
  return (tree) => {
    visit(
      tree,
      "element",
      (node, index, parent) => {
        if (node.tagName === "code" && node.data?.meta) {
            global.exampleBlockMap.set(hastToString(node).trim(), node.data?.meta)
        }
      },
    );
  };
};

export const rehypeExampleBlockTransformerPost: Plugin<[], Root> = () => {
  return (tree) => {
    visit(
      tree,
      "element",
      (node, index, parent) => {
        if (node.tagName === "code") {
            if (parent && 'tagName' in parent && parent.tagName === 'pre') {
                const nodeString = hastToString(node).trim();

                parent.properties = {
                    ...parent.properties,
                    meta: global.exampleBlockMap.get(nodeString),     
                }
            }
        }
      },
      true,
    );

    return tree;
  };
};

