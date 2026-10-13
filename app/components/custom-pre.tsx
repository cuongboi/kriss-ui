import { cn } from "@/lib/utils";
import { transform } from "@babel/standalone";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "fumadocs-ui/components/ui/tabs";
import React from "react";
import innerText from "react-innertext";
import { Card } from "./ui/card";
import { z } from "zod";
import * as icons from "lucide-react";
import * as reactHookForm from "react-hook-form";
import * as hookformZodResolver from "@hookform/resolvers/zod";
import * as sonner from "sonner";
import * as dateFns from "date-fns";

// node_modules packages that example code blocks are allowed to import
const nodeModules: Record<string, Record<string, unknown>> = {
  react: { ...React, default: React },
  zod: { z, default: z },
  "lucide-react": icons,
  "react-hook-form": reactHookForm,
  "@hookform/resolvers/zod": hookformZodResolver,
  sonner,
  "date-fns": dateFns,
};

const globModules = import.meta.glob(["./{components,hooks}/**/*.{ts,tsx}"], {
  eager: true,
  base: "../",
});

const libvars: Record<string, unknown> = {
  z,
  React,
  cn,
  ...icons,
};

const loadModule = (modulePath: string): Record<string, unknown> => {
  modulePath = modulePath.replace("@/", "./");
  const moduleKey =
    Object.keys(globModules).find((key) => {
      const normalizedKey = key.replace("../", "./");
      return (
        normalizedKey === modulePath ||
        normalizedKey === `${modulePath}.tsx` ||
        normalizedKey === `${modulePath}.ts` ||
        normalizedKey === `${modulePath}/index.tsx` ||
        normalizedKey === `${modulePath}/index.ts`
      );
    }) || "";

  if (!moduleKey) {
    throw new Error(`[CustomPre] Failed to load module: ${modulePath}`);
  }

  return globModules[moduleKey] as Record<string, unknown>;
};

function parseAttributesToObject(input: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Regex to match key="value" or key='value'
  const attributeRegex = /([\w-]+)\s*=\s*["']([^"']*)["']/g;

  let match: RegExpExecArray | null;

  while (true) {
    match = attributeRegex.exec(input);
    if (!match) break;

    const [, key, value] = match;
    result[key] = value;
  }

  return result;
}

const extractImports = (
  code: string,
): Array<{
  name: string;
  importedName: string;
  source?: string;
  type: "default" | "named" | "namespace";
}> => {
  const imports: Array<{
    name: string;
    importedName: string;
    source?: string;
    type: "default" | "named" | "namespace";
  }> = [];

  // Match different import patterns
  const importRegex = /import\s+([^;]+?)\s+from\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: using while
  while ((match = importRegex.exec(code)) !== null) {
    const importClause = match[1].trim();
    const source = match[2];

    if (importClause.startsWith("type ")) {
      continue;
    }

    // Default + named: import React, { useState } from 'react'
    const mixed = importClause.match(/^([\w$]+)\s*,\s*(\{[\s\S]*\})$/);
    if (mixed) {
      imports.push(
        ...extractImports(
          `import ${mixed[1]} from "${source}";\nimport ${mixed[2]} from "${source}";`,
        ),
      );
    } else if (importClause.startsWith("{")) {
      // Named imports: import { A, B as C } from 'module'
      const namedPart = importClause.slice(1, -1);
      namedPart.split(",").forEach((item) => {
        const trimmed = item.trim();
        if (!trimmed || trimmed.startsWith("type ")) return;

        const asIndex = trimmed.toLowerCase().indexOf(" as ");
        const importedName =
          asIndex > -1 ? trimmed.slice(0, asIndex).trim() : trimmed;
        const name = asIndex > -1 ? trimmed.slice(asIndex + 4).trim() : trimmed;

        if (name) {
          imports.push({ name, importedName, source, type: "named" });
        }
      });
    } else if (importClause.startsWith("* as ")) {
      // Namespace: import * as React from 'react'
      const name = importClause.replace("* as ", "").trim();
      imports.push({ name, importedName: name, source, type: "namespace" });
    } else {
      // Default import: import React from 'react'
      const name = importClause.trim();
      imports.push({ name, importedName: "default", source, type: "default" });
    }
  }

  return imports;
};

// Resolve using import-sync + proper named export handling
const resolveImports = (importList: ReturnType<typeof extractImports>) => {
  for (const imp of importList) {
    if (!imp.source) continue;

    try {
      let module: Record<string, unknown>;

      if (imp.source.startsWith("@/")) {
        module = loadModule(imp.source);
      } else if (imp.source in nodeModules) {
        module = nodeModules[imp.source];
      } else {
        throw new Error(
          `[CustomPre] Module "${imp.source}" is not registered in nodeModules`,
        );
      }

      if (imp.type === "named") {
        libvars[imp.name] = module[imp.importedName];
      } else if (imp.type === "default") {
        libvars[imp.name] = module.default || module;
      } else {
        libvars[imp.name] = module;
      }
    } catch (err) {
      console.warn(`[CustomPre] Failed to import ${imp.name}`, err);
    }
  }

  return libvars;
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error(errorInfo, error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export const CustomPre: React.FC<
  React.PropsWithoutRef<{ children?: React.ReactNode }> &
  React.ComponentProps<typeof CodeBlock> & { meta?: string; code?: string }
> = ({ children, ...props }) => {
  const codeContent = React.useMemo(() => innerText(children), [children]);
  const meta = React.useMemo(
    () => parseAttributesToObject(String(props.meta)),
    [props.meta],
  );

  let DynamicComponent: React.ComponentType | null = null;

  if (meta.example !== undefined) {
    try {
      let transpile =
        transform(codeContent, {
          presets: [
            "react",
            ["typescript", { allExtensions: true, isTSX: true }],
          ],
        })?.code ?? "";

      transpile = transpile.replace(
        /^\s*import\s+(?:[^;]+?\s+from\s+)?["'][^"']+["'];?/gm,
        "",
      );

      const importedNames = extractImports(codeContent);
      const imports = resolveImports(importedNames);
      const body = transpile.replace(/export default|export/, "return ");
      const params = ["React", ...importedNames.map((imp) => imp.name)];
      const values = [React, ...importedNames.map((imp) => imports[imp.name])];

      DynamicComponent = new Function(...params, body)(...values);
    } catch (err) {
      console.error(err);
    }
  }

  if (!DynamicComponent) {
    return (
      <CodeBlock {...props}>
        <Pre>{children}</Pre>
      </CodeBlock>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <CodeBlock
          className="my-0 rounded-none border-x-0 border-b-0 border-t shadow-none"
          viewportProps={{ className: "max-h-[450px]" }}
        >
          <Pre>{children}</Pre>
        </CodeBlock>
      }
    >
      <Card
        data-slot="component-preview"
        className={cn(
          "not-prose group relative flex flex-col gap-0 overflow-hidden rounded bg-transparent p-0 shadow-xs ring-1 ring-foreground/10 ",
        )}
      >
        <Tabs defaultValue="preview" className="gap-0">
          <TabsList className="flex  h-auto w-full justify-start gap-4 rounded-none border-b border-foreground/10 bg-transparent px-3 py-2">
            <TabsTrigger
              value="preview"
              className="text-muted-foreground data-[state=active]:text-foreground"
            >
              Preview
            </TabsTrigger>
            <TabsTrigger
              value="code"
              className="text-muted-foreground data-[state=active]:text-foreground"
            >
              Code
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="preview"
            className={cn(
              "preview relative flex min-h-44 items-center justify-center p-10 outline-none",
            )}
          >
            <div className="w-full">
              <DynamicComponent />
            </div>
          </TabsContent>

          <TabsContent value="code" className="mt-0 outline-none">
            <CodeBlock
              className="my-0 rounded-none border-x-0 border-b-0 border-t shadow-none"
              viewportProps={{ className: "max-h-[450px]" }}
            >
              <Pre>{children}</Pre>
            </CodeBlock>
          </TabsContent>
        </Tabs>
      </Card>
    </ErrorBoundary>
  );
};
