export function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'Upload',
      description: 'Choose an image from your device or take a photo with your camera.',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      number: '02',
      title: 'AI Removal',
      description: 'Our AI detects the subject and automatically removes the background.',
      color: 'from-purple-500 to-pink-500',
    },
    {
      number: '03',
      title: 'Perfect It',
      description: 'Use Remove and Recover brushes for pixel-level control and precision.',
      color: 'from-orange-500 to-red-500',
    },
    {
      number: '04',
      title: 'Download',
      description: 'Export your image with custom background or transparency.',
      color: 'from-green-500 to-emerald-500',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 px-4 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Four simple steps to perfect images
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connection line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-gray-300 to-transparent dark:from-gray-700 -z-10" />
              )}

              <div className="text-center">
                {/* Number */}
                <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br ${step.color} text-white text-3xl font-bold shadow-lg mb-6`}>
                  {step.number}
                </div>

                {/* Content */}
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
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
