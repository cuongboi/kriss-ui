import type { Route } from "./+types/docs";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
	MarkdownCopyButton,
	ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import { getPageMarkdownUrl, source } from "@/lib/source";
import browserCollections from "collections/browser";
import { baseOptions } from "@/lib/layout.shared";
import { gitConfig } from "@/lib/shared";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { getPageImagePath } from "@/lib/og";
import { useMDXComponents } from "@/components/mdx";

export async function loader({ params, request }: Route.LoaderArgs) {
	const slugs = params["*"].split("/").filter((v) => v.length > 0);
	const page = source.getPage(slugs);
	if (!page) throw new Response("Not found", { status: 404 });

	return {
		path: page.path,
		markdownUrl: getPageMarkdownUrl(page).url,
		pageTree: await source.serializePageTree(source.getPageTree()),
		imagePath: getPageImagePath(slugs),
		url: request.url,
	};
}

const clientLoader = browserCollections.docs.createClientLoader({
	component(
		{ toc, frontmatter, default: Mdx },
		// you can define props for the `<Content />` component
		{
			markdownUrl,
			path,
			imagePath,
			url,
		}: {
			markdownUrl: string;
			path: string;
			imagePath: string;
			url: string;
		},
	) {
		return (
			<DocsPage toc={toc}>
				<title>{frontmatter.title}</title>
				<meta name="description" content={frontmatter.description} />
				<meta property="og:image" content={imagePath} />
				<DocsTitle>{frontmatter.title}</DocsTitle>
				<DocsDescription>{frontmatter.description}</DocsDescription>
				<div className="flex flex-row gap-2 items-center border-b -mt-4 pb-6">
					<MarkdownCopyButton markdownUrl={markdownUrl} />
					<ViewOptionsPopover
						markdownUrl={markdownUrl}
						githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${path}`}
					/>
				</div>
				<DocsBody>
					{/** biome-ignore lint/correctness/useHookAtTopLevel: Non-Top level*/}
					<Mdx components={useMDXComponents()} />
				</DocsBody>
			</DocsPage>
		);
	},
});

export default function Page({ loaderData }: Route.ComponentProps) {
	const { path, pageTree, imagePath, markdownUrl } =
		useFumadocsLoader(loaderData);

	return (
		<DocsLayout {...baseOptions()} tree={pageTree}>
			{clientLoader.useContent(path, {
				markdownUrl,
				path,
				imagePath,
				url: loaderData.url,
			})}
		</DocsLayout>
	);
}
