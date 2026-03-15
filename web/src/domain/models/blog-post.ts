export interface BlogPostSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export interface BlogPost {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly publishedAt: string;
  readonly readingTimeMinutes: number;
  readonly sections: readonly BlogPostSection[];
}
