import Link from 'next/link';
import Image from 'next/image';
import { Video } from '@/types';

interface VideoCardProps {
  video: Video;
}

const difficultyConfig = {
  beginner: { label: '초급', english: 'Beginner', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  intermediate: { label: '중급', english: 'Intermediate', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  advanced: { label: '고급', english: 'Advanced', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoCard({ video }: VideoCardProps) {
  const diff = difficultyConfig[video.difficulty];

  return (
    <Link href={`/video/${video.id}`} className="group block">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all duration-200 h-full flex flex-col">
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden bg-gray-100">
          <Image
            src={video.thumbnail}
            alt={video.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
          <div className="absolute bottom-2 right-2 bg-black/75 text-white text-xs font-medium px-1.5 py-0.5 rounded">
            {formatDuration(video.durationSeconds)}
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
              <svg className="w-5 h-5 text-indigo-600 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${diff.className}`}>
              {diff.label} · {diff.english}
            </span>
            <span className="text-xs text-gray-400 whitespace-nowrap">{video.transcript.length} segments</span>
          </div>

          <h3 className="font-bold text-gray-900 text-base leading-snug mb-1 group-hover:text-indigo-700 transition-colors">
            {video.titleKorean}
          </h3>
          <p className="text-sm text-gray-500 mb-2 font-medium">{video.title}</p>
          <p className="text-xs text-gray-500 leading-relaxed flex-1 line-clamp-2">{video.description}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-gray-50">
            {video.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
