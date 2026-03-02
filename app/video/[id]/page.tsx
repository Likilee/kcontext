import Link from 'next/link';
import { notFound } from 'next/navigation';
import { videos } from '@/data/videos';
import VideoPlayer from '@/components/VideoPlayer';
import TranscriptPanel from '@/components/TranscriptPanel';
import VocabularyCard from '@/components/VocabularyCard';
import Header from '@/components/Header';

interface PageProps {
  params: Promise<{ id: string }>;
}

const difficultyConfig = {
  beginner: { label: '초급', english: 'Beginner', className: 'bg-emerald-100 text-emerald-700' },
  intermediate: { label: '중급', english: 'Intermediate', className: 'bg-amber-100 text-amber-700' },
  advanced: { label: '고급', english: 'Advanced', className: 'bg-rose-100 text-rose-700' },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function generateStaticParams() {
  return videos.map((v) => ({ id: v.id }));
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const video = videos.find((v) => v.id === id);
  if (!video) return { title: 'Video Not Found' };
  return {
    title: `${video.titleKorean} · kcontext`,
    description: video.description,
  };
}

export default async function VideoPage({ params }: PageProps) {
  const { id } = await params;
  const video = videos.find((v) => v.id === id);

  if (!video) notFound();

  const diff = difficultyConfig[video.difficulty];

  // Collect all unique vocabulary across all transcript entries
  const allVocabulary = Array.from(
    new Map(
      video.transcript.flatMap((t) => t.vocabulary).map((v) => [v.korean, v])
    ).values()
  );

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex flex-col">
      <Header />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors mb-6 group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          목록으로 돌아가기 · Back to videos
        </Link>

        {/* Video title */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${diff.className}`}>
              {diff.label} · {diff.english}
            </span>
            <span className="text-xs text-gray-400 bg-white border border-gray-100 rounded-full px-2.5 py-1">
              ⏱ {formatDuration(video.durationSeconds)}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight korean-text">
            {video.titleKorean}
          </h1>
          <p className="text-lg text-gray-500 mt-1">{video.title}</p>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-3xl">{video.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {video.tags.map((tag) => (
              <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full font-medium">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Layout: video + transcript left, flashcards right */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left column: video + transcript */}
          <div className="xl:col-span-2 space-y-8">
            <VideoPlayer youtubeId={video.youtubeId} title={video.titleKorean} />
            <TranscriptPanel transcript={video.transcript} />
          </div>

          {/* Right column: vocabulary flashcards */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-6">
              <VocabularyCard vocabulary={allVocabulary} />
            </div>
          </div>
        </div>

        {/* Other videos section */}
        <section className="mt-16">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            다른 동영상 · More Videos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {videos
              .filter((v) => v.id !== video.id)
              .slice(0, 3)
              .map((v) => {
                const d = difficultyConfig[v.difficulty];
                return (
                  <Link key={v.id} href={`/video/${v.id}`} className="group flex gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:border-indigo-200 hover:shadow-sm transition-all">
                    <div className="relative w-28 flex-shrink-0 aspect-video rounded-lg overflow-hidden bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={v.thumbnail}
                        alt={v.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${d.className}`}>
                        {d.label}
                      </span>
                      <p className="text-sm font-bold text-gray-900 mt-1 group-hover:text-indigo-700 transition-colors line-clamp-2 korean-text">
                        {v.titleKorean}
                      </p>
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-gray-100 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-400">
          kcontext · YouTube로 배우는 한국어
        </div>
      </footer>
    </div>
  );
}
