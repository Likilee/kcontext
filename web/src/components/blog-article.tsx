import Link from "next/link";
import type { BlogPost } from "@/domain/models/blog-post";
import { BLOG_INDEX_PATH } from "@/lib/app-routes";
import { formatBlogPublishedDate } from "@/lib/blog-published-date";

interface BlogArticleProps {
  readonly post: BlogPost;
}

export function BlogArticle({ post }: BlogArticleProps) {
  return (
    <article className="rounded-[var(--radius-08)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-layout-screen)]">
      <header className="flex flex-col gap-[var(--space-gap-item)] border-b border-[var(--border-default)] pb-[var(--space-gap-group)]">
        <Link
          href={BLOG_INDEX_PATH}
          className="text-[length:var(--font-size-13)] font-medium text-[var(--brand-highlight)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--action-primary)]"
        >
          Back to blog
        </Link>
        <div className="flex flex-wrap items-center gap-[var(--space-gap-item)] text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
          <span>{formatBlogPublishedDate(post.publishedAt)}</span>
          <span aria-hidden="true">•</span>
          <span>{post.readingTimeMinutes} min read</span>
        </div>
        <h2 className="max-w-3xl text-[length:var(--font-size-28)] font-bold leading-[var(--line-height-tight)] text-[var(--text-primary)]">
          {post.title}
        </h2>
        <p className="max-w-3xl text-[length:var(--font-size-18)] leading-[var(--line-height-relaxed)] text-[var(--text-secondary)]">
          {post.excerpt}
        </p>
      </header>

      <div className="mt-[var(--space-gap-group)] flex flex-col gap-[var(--space-gap-group)]">
        {post.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-[var(--space-gap-item)]">
            <h3 className="text-[length:var(--font-size-20)] font-semibold text-[var(--text-primary)]">
              {section.heading}
            </h3>
            <div className="flex flex-col gap-[var(--space-gap-item)]">
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-[length:var(--font-size-16)] leading-[var(--line-height-relaxed)] text-[var(--text-primary)]"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
