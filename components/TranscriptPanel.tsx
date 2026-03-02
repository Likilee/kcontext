'use client';

import { useState } from 'react';
import { Transcript, VocabularyItem } from '@/types';

interface TranscriptPanelProps {
  transcript: Transcript[];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function KoreanWord({
  word,
  vocabulary,
}: {
  word: string;
  vocabulary: VocabularyItem[];
}) {
  const [popup, setPopup] = useState(false);
  const match = vocabulary.find((v) => word.includes(v.korean));

  if (!match) {
    return <span>{word} </span>;
  }

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setPopup((p) => !p)}
        className="text-indigo-700 font-semibold underline decoration-dotted decoration-indigo-400 hover:text-indigo-900 transition-colors cursor-pointer"
      >
        {word}
      </button>{' '}
      {popup && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setPopup(false)} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-white border border-indigo-100 rounded-xl shadow-xl p-3 min-w-[160px] text-left">
            <div className="text-lg font-bold text-indigo-700 leading-tight">{match.korean}</div>
            <div className="text-xs text-gray-500 font-mono mb-1">{match.romanization}</div>
            <div className="text-sm text-gray-800 font-medium">{match.english}</div>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-indigo-100 rotate-45" />
          </div>
        </>
      )}
    </span>
  );
}

function TranscriptEntry({ entry }: { entry: Transcript }) {
  const [expanded, setExpanded] = useState(false);

  // Split Korean text into words for clickable vocab
  const koreanWords = entry.korean.split(' ');

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden hover:border-indigo-200 transition-colors">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-indigo-50/50 transition-colors"
      >
        <span className="flex-shrink-0 text-xs font-mono bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-md mt-0.5">
          {formatTime(entry.timeStart)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 font-medium text-base leading-relaxed korean-text">
            {koreanWords.map((word, i) => (
              <KoreanWord key={i} word={word} vocabulary={entry.vocabulary} />
            ))}
          </p>
          <p className="text-gray-500 text-sm mt-1">{entry.english}</p>
        </div>
        <svg
          className={`flex-shrink-0 w-4 h-4 text-gray-400 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 bg-gray-50/50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-3">
            단어 · Vocabulary
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {entry.vocabulary.map((vocab) => (
              <div
                key={vocab.korean}
                className="flex items-center gap-3 bg-white rounded-lg p-2.5 border border-gray-100"
              >
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-600 text-sm font-bold">{vocab.korean[0]}</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-900 korean-text">{vocab.korean}</span>
                    <span className="text-xs text-gray-400 font-mono">{vocab.romanization}</span>
                  </div>
                  <span className="text-xs text-gray-600">{vocab.english}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TranscriptPanel({ transcript }: TranscriptPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 bg-indigo-600 rounded-full" />
        <h2 className="text-lg font-bold text-gray-900">스크립트 · Transcript</h2>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
          Click Korean words for definitions
        </span>
      </div>
      {transcript.map((entry) => (
        <TranscriptEntry key={entry.timeStart} entry={entry} />
      ))}
    </div>
  );
}
