import { Sparkles, Wand2, Undo2, Camera, Layers, Palette, ArrowLeftRight, Download, Sun } from 'lucide-react';

export function FeaturesSection() {
  const features = [
    {
      icon: Sparkles,
      title: 'AI Background Removal',
      description: 'Advanced AI instantly detects and removes backgrounds with precision.',
    },
    {
      icon: Wand2,
      title: 'Magic Remove Brush',
      description: 'Manually refine by painting over areas you want to remove.',
    },
    {
      icon: Undo2,
      title: 'Recover Brush',
      description: 'Restore accidentally removed areas with the recovery tool.',
    },
    {
      icon: Camera,
      title: 'Camera Capture',
      description: 'Take photos directly from your device camera.',
    },
    {
      icon: Layers,
      title: 'Transparent Backgrounds',
      description: 'Export with true transparency for professional results.',
    },
    {
      icon: Palette,
      title: 'Custom Backgrounds',
      description: 'Choose solid colors, gradients, or upload your own image.',
    },
    {
      icon: ArrowLeftRight,
      title: 'Before & After',
      description: 'Compare original and edited images side by side.',
    },
    {
      icon: Download,
      title: 'High Resolution Export',
      description: 'Download in PNG, JPG, or WEBP with full quality.',
    },
    {
      icon: Sun,
      title: 'Dark & Light Mode',
      description: 'Work comfortably in your preferred theme.',
    },
  ];

  return (
    <section id="features" className="py-20 px-4 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Powerful Features
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Everything you need for professional image editing
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:bg-gradient-to-br hover:from-primary-50 hover:to-purple-50 dark:hover:from-primary-900/20 dark:hover:to-purple-900/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
