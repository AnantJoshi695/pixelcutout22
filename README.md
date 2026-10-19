# PixelCutout - AI Background Remover

A modern, production-quality AI-powered image background remover web application built with React, TypeScript, and Tailwind CSS.

## Features

### Core Functionality
- **AI Background Removal**: Automatically detect and remove image backgrounds
- **Manual Editing Tools**:
  - **Remove Brush**: Paint over areas to remove
  - **Recover Brush**: Restore accidentally removed areas
  - **Eraser**: Remove brush strokes
- **Adjustable Brush**: Size and hardness controls
- **Undo/Redo**: Full history management with keyboard shortcuts

### Image Input
- **Upload**: Drag & drop, browse, or paste images
- **Camera Capture**: Take photos directly from device camera
- **Supported Formats**: JPG, PNG, WEBP, HEIC

### Background Customization
- **Transparent**: Export with alpha channel
- **Solid Colors**: Choose from presets or custom colors
- **Gradients**: Pre-designed gradient backgrounds
- **Blur**: Apply blur to original background
- **Image Upload**: Use custom background images

### Editor Features
- **Zoom & Pan**: Navigate large images easily
- **Before/After Comparison**: View original vs edited
- **Keyboard Shortcuts**: 
  - `Ctrl/Cmd + Z`: Undo
  - `Ctrl/Cmd + Shift + Z`: Redo
- **Professional Layout**: Multi-panel editor interface

### Export
- **Multiple Formats**: PNG, JPG, WEBP
- **Quality Control**: Adjustable compression
- **High Resolution**: Full-size exports

### User Experience
- **Dark/Light/System Theme**: Seamless theme switching
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Accessibility**: Keyboard navigation and ARIA labels
- **Loading States**: Beautiful processing animations
- **Error Handling**: User-friendly error messages

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **Framer Motion** - Animations
- **HTML5 Canvas** - Image manipulation

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/          # React components
│   ├── Navbar.tsx
│   ├── UploadZone.tsx
│   ├── CameraModal.tsx
│   ├── ImageEditor.tsx
│   ├── EditorToolbar.tsx
│   ├── BackgroundPanel.tsx
│   ├── ProcessingOverlay.tsx
│   ├── ThemeToggle.tsx
│   ├── FeaturesSection.tsx
│   ├── HowItWorksSection.tsx
│   └── Footer.tsx
├── pages/              # Page components
│   └── Home.tsx
├── hooks/              # Custom React hooks
│   ├── useTheme.ts
│   └── useHistory.ts
├── services/           # Business logic
│   └── backgroundRemoval.ts
├── utils/              # Utility functions
│   ├── canvas.ts
│   └── image.ts
├── types/              # TypeScript types
│   └── index.ts
├── App.tsx             # Root component
├── main.tsx            # Entry point
└── index.css           # Global styles
```

## Architecture

### Background Removal Service
The `backgroundRemoval.ts` service provides a clean API abstraction:

```typescript
removeBackground(imageFile: File): Promise<Blob>
```

The current implementation uses a demo algorithm for demonstration. In production, replace with:
- **remove.bg API**
- **Cloudinary Background Removal**
- **Custom ML model** (TensorFlow.js, ONNX Runtime)
- **Server-side processing** with Python/PyTorch

### Canvas Manager
The `CanvasManager` class handles all image manipulation:
- Layer management (original, processed, mask, recover)
- Brush stroke rendering
- Background application
- Export functionality

### State Management
- **Local state** for component-specific data
- **Custom hooks** for reusable logic (theme, history)
- **History hook** implements undo/redo with immutable state snapshots

## Customization

### Integrating Real AI API

Replace the demo implementation in `src/services/backgroundRemoval.ts`:

```typescript
export async function removeBackground(imageFile: File): Promise<Blob> {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch('YOUR_API_ENDPOINT', {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_API_KEY}`
    }
  });

  return await response.blob();
}
```

### Theme Colors

Modify `tailwind.config.js` to change the color scheme:

```js
colors: {
  primary: {
    // Your color palette
  }
}
```

### Branding

Update the brand name and logo in:
- `src/components/Navbar.tsx`
- `src/components/Footer.tsx`
- `index.html` (title, meta tags)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with camera API support

## Performance

- Lazy loading for optimal initial load
- Canvas optimization for large images
- Efficient undo/redo with structural sharing
- Debounced brush operations

## Security

- Client-side processing (no server uploads by default)
- File type validation
- File size limits
- Input sanitization

## Privacy

Images are processed entirely in the browser. No data is sent to external servers unless you integrate a third-party API.

## License

MIT

## Credits

Built as a modern alternative to traditional background removal tools, with inspiration from remove.bg's simplicity and a focus on giving users complete control over their edits.
