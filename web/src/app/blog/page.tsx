import Link from "next/link";
import { BlogPageShell } from "@/components/blog-page-shell";
import { BLOG_INDEX_PATH, getBlogPostPath } from "@/lib/app-routes";
import { getBlogPosts } from "@/lib/blog-posts";
import { getRequestSiteConfig } from "../request-site-config";

function formatPublishedDate(publishedAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
  }).format(new Date(`${publishedAt}T00:00:00Z`));
}

export default async function BlogIndexPage() {
  const siteConfig = await getRequestSiteConfig();
  const posts = getBlogPosts();

  return (
    <BlogPageShell
      siteConfig={siteConfig}
      eyebrow="Tubelang blog"
      title="Notes on learning Korean from native subtitle context"
      description="Short essays about how to study Korean with real YouTube subtitles, context windows, and repeatable search workflows."
    >
      <section className="flex flex-col gap-[var(--space-gap-item)]">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={getBlogPostPath(post.slug)}
            className="rounded-[var(--radius-08)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-layout-screen)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--bg-surface-hover)]"
          >
            <article className="flex flex-col gap-[var(--space-gap-item)]">
              <p className="text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
                {formatPublishedDate(post.publishedAt)} · {post.readingTimeMinutes} min read
              </p>
              <h2 className="text-[length:var(--font-size-20)] font-semibold text-[var(--text-primary)]">
                {post.title}
              </h2>
              <p className="max-w-3xl text-[length:var(--font-size-16)] leading-[var(--line-height-relaxed)] text-[var(--text-secondary)]">
                {post.excerpt}
              </p>
              <p className="text-[length:var(--font-size-13)] font-medium text-[var(--brand-highlight)]">
                Read article
              </p>
            </article>
          </Link>
        ))}
      </section>

      <section className="rounded-[var(--radius-08)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-layout-screen)]">
        <p className="text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
          New posts will live under <code>{BLOG_INDEX_PATH}</code> and reuse the same typed content
          structure.
        </p>
      </section>
    </BlogPageShell>
  );
}
