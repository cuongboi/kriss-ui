import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Route } from "./+types/registry";

export async function loader({ params }: Route.LoaderArgs) {
  let { component: componentName } = params;
  const registryPath = resolve(process.cwd(), "registries", componentName);

  if (!existsSync(registryPath)) {
    return new Response(JSON.stringify({ error: "Component not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  componentName = componentName.replace(".json", "");

  if (!registryPath) {
    return new Response(JSON.stringify({ error: "Component not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const registryJson = readFileSync(registryPath, "utf-8");
  let registryContent: { files: { content: string; name: string }[] } = {
    files: [],
  };

  try {
    registryContent = JSON.parse(registryJson);

    for (const [key, values] of Object.entries(registryContent)) {
      if (key !== "files") continue;

      for (const i in values) {
        const item = values[i];
        const filePath = resolve(process.cwd(), item.content);

        if (existsSync(filePath)) {
          const fileContent = readFileSync(filePath, "utf-8");
          registryContent.files[i] = { ...item, content: fileContent };
        } else {
          console.log(`File ${filePath} not found`);
          registryContent.files[i] = item;
        }
      }
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid registry JSON" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  return new Response(JSON.stringify(registryContent), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
