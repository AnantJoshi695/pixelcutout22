export function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'Upload',
      description: 'Choose an image from your device or take a photo with your camera.',
      accent: 'bg-green-500',
      bg: 'bg-surface dark:bg-dark-surface',
      border: 'border-frame dark:border-dark-border',
    },
    {
      number: '02',
      title: 'AI Removal',
      description: 'Our AI detects the subject and automatically removes the background.',
      accent: 'bg-green-500',
      bg: 'bg-surface dark:bg-dark-surface',
      border: 'border-frame dark:border-dark-border',
    },
    {
      number: '03',
      title: 'Perfect It',
      description: 'Use Remove and Recover brushes for pixel-level control and precision.',
      accent: 'bg-green-500',
      bg: 'bg-surface dark:bg-dark-surface',
      border: 'border-frame dark:border-dark-border',
    },
    {
      number: '04',
      title: 'Download',
      description: 'Export your image with custom background or transparency.',
      accent: 'bg-green-500',
      bg: 'bg-surface dark:bg-dark-surface',
      border: 'border-frame dark:border-dark-border',
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-4 bg-surface dark:bg-dark-surface">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-ink dark:text-green-50 mb-4">
            How It Works
          </h2>
          <p className="text-lg text-mute dark:text-green-300">
            Four simple steps to perfect images
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connection line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-full w-full h-px bg-gradient-to-r from-green-300 dark:from-green-600 to-transparent -z-10" />
              )}

              <div className={`text-center rounded-2xl p-6 ${step.bg} border ${step.border}`}>
                {/* Number */}
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${step.accent} text-white text-lg font-bold shadow-md shadow-green-600/20 mb-5`}>
                  {step.number}
                </div>

                {/* Content */}
                <h3 className="text-base font-bold text-ink dark:text-green-50 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-mute dark:text-green-300 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
