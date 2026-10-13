import { readFileSync, writeFileSync } from "fs";

const registry = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "auto-form",
  type: "registry:ui",
  title: "Auto Form",
  description:
    "A form component that automatically generates fields based on a Zod schema.",
  dependencies: ["deepmerge", "zod@^4.1.13"],
  devDependencies: [],
  registryDependencies: [
    "form",
    "input",
    "button",
    "label",
    "checkbox",
    "select",
    "dialog",
  ],
  files: [
    {
      path: "registry/default/ui/auto-form.tsx",
      content: "// Add the content of ./src/components/ui/auto-form.tsx here\n",
      type: "registry:ui",
    },
    {
      path: "registry/default/hooks/use-form-modal.tsx",
      content:
        "// Add the content of ./src/hooks/use-form-modal.tsx here\n",
      type: "registry:hook",
    }
  ],
};

const filePath = "./src/components/ui/auto-form.tsx";

const generateRegistry = () => {
  const componentContent = readFileSync(filePath, "utf-8");
  registry.files[0].content = componentContent;
  const hookContent = readFileSync("./src/hooks/use-form-modal.tsx", "utf-8");
  registry.files[1].content = hookContent;

  let registryContent = JSON.stringify(registry, null, 2);
  registryContent = registryContent.replace(
    new RegExp("@thietcn/form/", "g"),
    "@/registry/default/"
  );



  writeFileSync("./auto-form.json", registryContent, "utf-8");
};

generateRegistry();
