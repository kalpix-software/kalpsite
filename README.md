# Kalpsite - Kalpix Games Website

A beautiful, modern Next.js website for Kalpix Games social gaming platform.

## Features

- 🎨 **Beautiful Design** - Modern, professional UI with smooth animations
- ⚡ **Performance** - Built with Next.js 14 and optimized for speed
- 🎭 **Animations** - Smooth transitions powered by Framer Motion
- ✨ **Visual Effects** - Particle backgrounds and advanced mechanics
- 📱 **Responsive** - Fully responsive design for all devices
- 🎯 **TypeScript** - Type-safe development
- 🎨 **Tailwind CSS** - Utility-first CSS framework

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **TSParticles** - Particle effects
- **Lucide React** - Icons
- **React Intersection Observer** - Scroll animations

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
# or
yarn install
```

2. Run the development server:

```bash
npm run dev
# or
yarn dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
kalpsite/
├── app/
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── components/
│   ├── Navigation.tsx   # Navigation bar
│   ├── Hero.tsx         # Hero section
│   ├── Features.tsx     # Features section
│   ├── Stats.tsx        # Statistics section
│   ├── About.tsx        # About section
│   ├── CTA.tsx          # Call-to-action section
│   ├── Footer.tsx       # Footer
│   └── ParticleBackground.tsx # Particle effects
├── hooks/
│   └── useCountUp.ts    # Count-up animation hook
└── public/              # Static assets
```

## Customization

### Colors

Edit `tailwind.config.ts` to customize the color scheme:

```typescript
colors: {
  primary: { ... },
  accent: { ... },
}
```

### Content

Update the content in each component file to match your needs.

## Build for Production

```bash
npm run build
npm start
```

## License

© 2024 Kalpix Games. All rights reserved.
