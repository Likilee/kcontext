import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-indigo-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-indigo-700 font-black text-lg leading-none">K</span>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight">kcontext</span>
              <p className="text-indigo-200 text-xs leading-none mt-0.5">YouTube로 배우는 한국어</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-indigo-100 hover:text-white transition-colors text-sm font-medium">
              동영상 <span className="text-indigo-300 text-xs">Videos</span>
            </Link>
            <Link href="/#beginner" className="text-indigo-100 hover:text-white transition-colors text-sm font-medium">
              초급 <span className="text-indigo-300 text-xs">Beginner</span>
            </Link>
            <Link href="/#intermediate" className="text-indigo-100 hover:text-white transition-colors text-sm font-medium">
              중급 <span className="text-indigo-300 text-xs">Intermediate</span>
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 bg-indigo-600 border border-indigo-500 rounded-full px-3 py-1 text-xs font-medium text-indigo-100">
              <span>🇰🇷</span>
              <span>한국어</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
