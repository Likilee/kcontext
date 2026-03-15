import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog-article";
import { BlogPageShell } from "@/components/blog-page-shell";
import { getBlogPostBySlug, getBlogPostSlugs } from "@/lib/blog-posts";
import { getRequestSiteConfig } from "../../request-site-config";

export const dynamicParams = false;

interface BlogPostPageProps {
  readonly params: Promise<{
    slug: string;
  }>;
}

export function generateStaticParams() {
  return getBlogPostSlugs().map((slug) => ({ slug }));
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const [{ slug }, siteConfig] = await Promise.all([params, getRequestSiteConfig()]);
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <BlogPageShell
      siteConfig={siteConfig}
      eyebrow="Tubelang blog"
      title={post.title}
      description="A reusable article route backed by typed static post data."
    >
      <BlogArticle post={post} />
    </BlogPageShell>
  );
}
