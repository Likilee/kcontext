import type { BlogPost } from "@/domain/models/blog-post";

const BLOG_POSTS = [
  {
    slug: "learn-korean-with-youtube-context",
    title: "Learn Korean in real context with YouTube subtitles",
    excerpt:
      "A lightweight study loop for turning native subtitles into repeatable Korean listening and reading practice.",
    publishedAt: "2026-03-14",
    readingTimeMinutes: 4,
    sections: [
      {
        heading: "Why context changes retention",
        paragraphs: [
          "Textbook phrases are tidy, but native Korean is full of clipped endings, filler words, and casual rhythm. Studying from real subtitles helps you notice how those forms actually appear in speech.",
          "When you save a phrase together with the surrounding sentence, speaker tone, and playback timing, it becomes much easier to remember when and why that expression is used.",
        ],
      },
      {
        heading: "What to capture from each clip",
        paragraphs: [
          "Start with one short subtitle chunk and check four things: the exact Korean wording, an English gloss or your own note, the grammar ending, and the situation where the line appears.",
          "For example, a line like '행복해요' is more useful when you also remember who said it, whether it sounded formal, and what emotion or reaction came right before it.",
        ],
      },
      {
        heading: "A simple Tubelang workflow",
        paragraphs: [
          "Search for a Korean word or phrase, open a result with subtitles, and replay only the moments that matter. This keeps vocabulary review anchored to natural video context instead of isolated flashcards.",
          "Over time you can collect multiple examples of the same pattern across different channels, which makes it easier to build intuition for real Korean usage.",
        ],
      },
    ],
  },
] as const satisfies readonly BlogPost[];

export function getBlogPosts(): readonly BlogPost[] {
  return BLOG_POSTS;
}

export function getBlogPostSlugs(): readonly string[] {
  return BLOG_POSTS.map((post) => post.slug);
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
