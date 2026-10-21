import { Sparkles, Upload } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  onUploadClick: () => void;
}

export function Navbar({ onUploadClick }: NavbarProps) {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-frame bg-paper/90 backdrop-blur-xl shadow-[0_1px_0_0_rgba(33,131,74,0.10),0_4px_20px_rgba(33,131,74,0.05)] dark:border-green-800/40 dark:bg-dark-surface/90 dark:shadow-[0_1px_0_0_rgba(57,169,107,0.15)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-500 shadow-md shadow-green-600/25">
              <Sparkles size={15} className="text-white" />
            </div>
            <span className="text-base font-extrabold tracking-tight text-ink dark:text-green-50">
              PixelCutout
            </span>
          </div>

          {/* Navigation */}
          <div className="hidden items-center gap-8 md:flex">
            <a href="#home" className="text-sm font-semibold text-mute transition-colors hover:text-green-600 dark:text-green-300 dark:hover:text-green-200">
              Home
            </a>
            <a href="#features" className="text-sm font-semibold text-mute transition-colors hover:text-green-600 dark:text-green-300 dark:hover:text-green-200">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-semibold text-mute transition-colors hover:text-green-600 dark:text-green-300 dark:hover:text-green-200">
              How It Works
            </a>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={onUploadClick}
              className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-green-600/20 transition-all hover:bg-green-600 hover:shadow-lg hover:shadow-green-600/30 active:scale-[0.97]"
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
