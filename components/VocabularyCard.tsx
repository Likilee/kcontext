'use client';

import { useState } from 'react';
import { VocabularyItem } from '@/types';

interface VocabularyCardProps {
  vocabulary: VocabularyItem[];
}

export default function VocabularyCard({ vocabulary }: VocabularyCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState<Set<number>>(new Set());

  const current = vocabulary[currentIndex];
  const total = vocabulary.length;
  const masteredCount = mastered.size;

  function next() {
    setFlipped(false);
    setTimeout(() => {
      setCurrentIndex((i) => (i + 1) % total);
    }, 150);
  }

  function prev() {
    setFlipped(false);
    setTimeout(() => {
      setCurrentIndex((i) => (i - 1 + total) % total);
    }, 150);
  }

  function toggleMastered() {
    setMastered((prev) => {
      const next = new Set(prev);
      if (next.has(currentIndex)) {
        next.delete(currentIndex);
      } else {
        next.add(currentIndex);
      }
      return next;
    });
  }

  if (!current) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-indigo-600 rounded-full" />
          <h2 className="text-lg font-bold text-gray-900">단어 카드 · Flashcards</h2>
        </div>
        <span className="text-sm text-gray-500">
          <span className="font-semibold text-emerald-600">{masteredCount}</span>/{total} mastered
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(masteredCount / total) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div
        className="relative cursor-pointer select-none"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: '180px',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {mastered.has(currentIndex) && (
              <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-400 rounded-full flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <p className="text-indigo-300 text-xs uppercase tracking-widest mb-3">한국어 · Korean</p>
            <p className="text-white text-4xl font-bold mb-2 korean-text">{current.korean}</p>
            <p className="text-indigo-300 text-sm font-mono">{current.romanization}</p>
            <p className="text-indigo-200 text-xs mt-4 absolute bottom-4">Tap to reveal meaning</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 bg-white border-2 border-indigo-200 rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">영어 · English</p>
            <p className="text-gray-900 text-3xl font-bold mb-2">{current.english}</p>
            <p className="text-indigo-600 text-lg font-medium korean-text">{current.korean}</p>
            <p className="text-gray-400 text-sm font-mono">{current.romanization}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={prev}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          이전
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 font-medium">
            {currentIndex + 1} / {total}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); toggleMastered(); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              mastered.has(currentIndex)
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {mastered.has(currentIndex) ? '완료됨' : '완료'}
          </button>
        </div>

        <button
          onClick={next}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          다음
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* All vocabulary list */}
      <div className="mt-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">전체 단어 · All Words</p>
        <div className="grid grid-cols-2 gap-2">
          {vocabulary.map((vocab, i) => (
            <button
              key={vocab.korean}
              onClick={() => { setCurrentIndex(i); setFlipped(false); }}
              className={`text-left p-2.5 rounded-xl border transition-all text-sm ${
                i === currentIndex
                  ? 'border-indigo-300 bg-indigo-50'
                  : mastered.has(i)
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <span className="font-bold text-gray-900 korean-text block">{vocab.korean}</span>
              <span className="text-xs text-gray-500">{vocab.english}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
