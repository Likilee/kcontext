'use client';
import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import SearchBar from '@/components/SearchBar';
import VideoCard from '@/components/VideoCard';
import { videos } from '@/data/videos';
import { Video } from '@/types';
type Difficulty = 'all' | 'beginner' | 'intermediate' | 'advanced';
const difficultyFilters: { value: Difficulty; label: string; korean: string }[] = [
  { value: 'all', label: 'All Levels', korean: '전체' },
  { value: 'beginner', label: 'Beginner', korean: '초급' },
  { value: 'intermediate', label: 'Intermediate', korean: '중급' },
  { value: 'advanced', label: 'Advanced', korean: '고급' },
];
const stats = [
  { value: '6', label: 'Videos', korean: '동영상' },
  { value: '38+', label: 'Vocabulary Words', korean: '단어' },
  { value: '3', label: 'Difficulty Levels', korean: '난이도' },
];
export default function Home() {
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('all');
  const filtered = useMemo<Video[]>(() => {
    return videos.filter((v) => {
      const matchesDifficulty = difficulty === 'all' || v.difficulty === difficulty;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        v.title.toLowerCase().includes(q) ||
        v.titleKorean.includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.tags.some((t) => t.toLowerCase().includes(q));
      return matchesDifficulty && matchesSearch;
    });
  }, [search, difficulty]);
  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff]">
      <Header />
      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-600 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm mb-6">
            <span>🇰🇷</span>
            <span className="font-medium">YouTube로 배우는 한국어</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4 leading-tight">
            Learn Korean Through<br />
            <span className="text-yellow-300">Real YouTube Videos</span>
          </h1>
          <p className="text-indigo-100 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
            Watch authentic Korean content with interactive transcripts. Click any word to see its meaning, and practice with vocabulary flashcards.
          </p>
          <SearchBar value={search} onChange={setSearch} />
          {/* Stats */}
          <div className="flex justify-center gap-8 mt-10">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black text-yellow-300">{s.value}</div>
                <div className="text-xs text-indigo-200 mt-0.5">
                  <div className="font-medium">{s.korean}</div>
                  <div>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Main content */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 flex-1">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2 flex-wrap">
            {difficultyFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setDifficulty(f.value)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  difficulty === f.value
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {f.korean} <span className="opacity-70 font-normal text-xs">· {f.label}</span>
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-500">
            {filtered.length}개의 동영상 · {filtered.length} videos
          </span>
        </div>
        {/* Video grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">검색 결과 없음</h3>
            <p className="text-gray-500">No results found for &quot;{search}&quot;</p>
            <button
              onClick={() => { setSearch(''); setDifficulty('all'); }}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </main>
      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-16 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm">K</span>
              </div>
              <span className="font-bold text-gray-800">kcontext</span>
              <span className="text-gray-400 text-sm">· YouTube로 배우는 한국어</span>
            </div>
            <div className="text-sm text-gray-400">
              영상을 보며 한국어를 배워보세요 · Learn Korean through authentic videos
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
