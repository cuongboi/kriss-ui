import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { rehypeExampleBlockTransformerPost, rehypeExampleBlockTransformerPre } from "./app/lib/rehype-example-transformer";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    rehypePlugins: (plugins) => {
      return [rehypeExampleBlockTransformerPre, ...plugins, rehypeExampleBlockTransformerPost];
    },
  },
});
