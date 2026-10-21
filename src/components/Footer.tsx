import { Sparkles } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-paper/80 dark:bg-dark-surface/80 backdrop-blur-sm border-t border-frame py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shadow-sm shadow-green-600/20">
                <Sparkles size={15} className="text-white" />
              </div>
              <span className="text-lg font-bold text-ink dark:text-green-50">
                PixelCutout
              </span>
            </div>
            <p className="text-sm text-mute dark:text-green-300 mb-4">
              AI-powered background removal with precise manual control.
            </p>
            <p className="text-xs text-muted dark:text-green-500">
              Built for creators.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-bold text-ink dark:text-green-100 mb-4 text-sm">Product</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#features" className="text-sm text-mute dark:text-green-300 hover:text-green-600 dark:hover:text-green-200 transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="text-sm text-mute dark:text-green-300 hover:text-green-600 dark:hover:text-green-200 transition-colors">
                  How It Works
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-ink dark:text-green-100 mb-4 text-sm">Legal</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#" className="text-sm text-mute dark:text-green-300 hover:text-green-600 dark:hover:text-green-200 transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-mute dark:text-green-300 hover:text-green-600 dark:hover:text-green-200 transition-colors">
                  Terms
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-mute dark:text-green-300 hover:text-green-600 dark:hover:text-green-200 transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-frame text-center text-sm text-mute dark:text-green-500">
          <p>© {new Date().getFullYear()} PixelCutout. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
