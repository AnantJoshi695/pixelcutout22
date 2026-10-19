import { Sparkles, Upload } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  onUploadClick: () => void;
}

export function Navbar({ onUploadClick }: NavbarProps) {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-purple-600">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-xl font-bold text-transparent">
              PixelCutout
            </span>
          </div>

          {/* Navigation */}
          <div className="hidden items-center gap-8 md:flex">
            <a href="#home" className="text-gray-700 transition-colors hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400">
              Home
            </a>
            <a href="#features" className="text-gray-700 transition-colors hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400">
              Features
            </a>
            <a href="#how-it-works" className="text-gray-700 transition-colors hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400">
              How It Works
            </a>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              type="button"
              onClick={onUploadClick}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white shadow-lg shadow-primary-500/30 transition-colors hover:bg-primary-700"
            >
              <Upload size={18} />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
