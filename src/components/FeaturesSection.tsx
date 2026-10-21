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
    <section id="features" className="py-24 px-4 bg-surface dark:bg-dark-surface">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-ink dark:text-green-50 mb-4">
            Powerful Features
          </h2>
          <p className="text-lg text-mute dark:text-green-300">
            Everything you need for professional image editing
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-6 rounded-2xl bg-paper border border-frame backdrop-blur-sm hover:border-green-300 dark:hover:border-green-600 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/8 hover:-translate-y-0.5 dark:bg-dark-card dark:border-dark-border dark:hover:border-green-600"
            >
              <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm shadow-green-600/20">
                <feature.icon size={18} className="text-white" />
              </div>
              <h3 className="text-base font-bold text-ink dark:text-green-50 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-mute dark:text-green-300 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
