# Design System: "Brass & Ivory Ledger"

**Concept:** A warm, editorial aesthetic inspired by vintage financial ledgers, luxury banking documents, and classical bookkeeping. The design evokes trust, permanence, and craftsmanship through rich typography, warm earth tones, and subtle paper-like textures.

**Anti-patterns to avoid:**
- Generic sans-serif fonts (Inter, Roboto, Arial, system fonts)
- Purple/blue gradients on white backgrounds
- Overly rounded corners and "bubbly" UI
- Flat, shadowless cards without texture
- Generic tech/SaaS aesthetic

---

## 1. Color Palette

### Primary Colors

```css
:root {
  /* Ivory - Backgrounds */
  --ivory-50: #FDFCFA;
  --ivory-100: #FAF7F2;   /* Primary background */
  --ivory-200: #F5F0E8;   /* Secondary background */
  --ivory-300: #EDE5D8;
  --ivory-400: #DDD2BE;
  --ivory-500: #C4B69A;

  /* Forest - Primary accent */
  --forest-50: #E8F0ED;
  --forest-100: #C5D9D0;
  --forest-200: #9EBFB0;
  --forest-300: #77A590;
  --forest-400: #5A9178;
  --forest-500: #3D7D60;
  --forest-600: #2F6A4F;
  --forest-700: #1F5640;
  --forest-800: #1a3a2f;   /* Primary buttons, headings */
  --forest-900: #0F2920;
  --forest-950: #071510;

  /* Brass - Accent highlights */
  --brass-50: #FDF8E8;
  --brass-100: #F9EEC5;
  --brass-200: #F3DC8A;
  --brass-300: #E5C54F;
  --brass-400: #D4A843;
  --brass-500: #C9A227;    /* Primary brass accent */
  --brass-600: #B8860B;    /* Darker brass */
  --brass-700: #946B09;
  --brass-800: #705008;
  --brass-900: #4C3605;

  /* Burgundy - Danger/negative states */
  --burgundy-50: #FCE8ED;
  --burgundy-100: #F8C5D1;
  --burgundy-200: #F09EB0;
  --burgundy-300: #E8778F;
  --burgundy-400: #D64D6A;
  --burgundy-500: #B82E4D;
  --burgundy-600: #8B2942;  /* Primary danger color */
  --burgundy-700: #6E1F34;
  --burgundy-800: #511626;
  --burgundy-900: #340D18;

  /* Charcoal - Text colors */
  --charcoal-50: #F5F4F3;
  --charcoal-100: #E8E6E4;
  --charcoal-200: #D4D0CC;
  --charcoal-300: #B8B2AB;
  --charcoal-400: #97908A;
  --charcoal-500: #776F68;  /* Secondary text */
  --charcoal-600: #5A5450;
  --charcoal-700: #3D3A38;
  --charcoal-800: #2D2A26;  /* Primary text */
  --charcoal-900: #1A1816;
  --charcoal-950: #0D0C0B;
}
```

### Color Usage Guidelines

| Element | Color | Usage |
|---------|-------|-------|
| Page background | `ivory-100` | Main app background with subtle noise texture |
| Card background | `ivory-50` | Slightly lighter than page for depth |
| Primary text | `charcoal-800` | All body text, headings |
| Secondary text | `charcoal-500` | Labels, meta info, timestamps |
| Muted text | `charcoal-400` | Placeholders, disabled states |
| Primary accent | `forest-800` | Buttons, links, important numbers |
| Highlight accent | `brass-500` | Decorative elements, badges, borders |
| Positive/success | `forest-700` | Credit additions, success states |
| Negative/danger | `burgundy-600` | Credit deductions, errors, warnings |
| Warning | `brass-500` | Low credit warnings, cautions |

---

## 2. Typography

### Font Stack

```typescript
// layout.tsx - Font imports
import { Cormorant_Garamond, Newsreader, JetBrains_Mono } from 'next/font/google'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})
```

### Font Usage

| Font | Class | Usage |
|------|-------|-------|
| **Cormorant Garamond** | `font-display` | Page titles, card headings, tier names, large display text |
| **Newsreader** | `font-body` | Body text, labels, descriptions, buttons, notices |
| **JetBrains Mono** | `font-mono` | Numbers, prices, credit counts, dates, tabular data |

### Typography Scale

```css
/* Page titles */
.page-title {
  @apply font-display text-4xl font-semibold text-forest-800 tracking-tight;
}

/* Section headers (uppercase with decorative line) */
.section-header {
  @apply text-xs font-body tracking-[0.2em] uppercase text-charcoal-500;
  display: flex;
  align-items: center;
  gap: 12px;
}
.section-header::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(201, 162, 39, 0.4), transparent);
}

/* Large display numbers */
.display-number {
  @apply font-mono text-5xl tracking-tight text-forest-800;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 0 rgba(255,255,255,0.8);
}

/* Body text */
.body-text {
  @apply font-body text-sm text-charcoal-600;
}

/* Monospace data */
.mono-data {
  @apply font-mono text-sm font-medium;
}
```

---

## 3. Backgrounds & Textures

### Page Background

The page has a warm ivory background with a subtle paper noise texture:

```css
body {
  @apply bg-ivory-100 text-charcoal-800 antialiased;
  background-image:
    linear-gradient(180deg, rgba(250, 247, 242, 0.97) 0%, rgba(245, 240, 232, 0.97) 100%),
    url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
  background-attachment: fixed;
}
```

### Card Background

Cards have a subtle gradient and brass accent on the left edge:

```css
.card-ledger {
  @apply bg-ivory-50 border border-charcoal-200/40 shadow-ledger;
  background-image:
    linear-gradient(to bottom, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 4px),
    linear-gradient(to right, rgba(201, 162, 39, 0.08) 0%, transparent 1px);
  background-size: 100% 100%, 4px 100%;
}
```

---

## 4. Shadows

Custom shadow system that mimics embossed paper:

```typescript
// tailwind.config.ts
boxShadow: {
  'ledger': '0 1px 0 0 rgba(29, 29, 27, 0.05), 0 4px 12px -2px rgba(29, 29, 27, 0.08)',
  'ledger-hover': '0 2px 0 0 rgba(29, 29, 27, 0.05), 0 8px 24px -4px rgba(29, 29, 27, 0.12)',
  'emboss': 'inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 1px 2px rgba(29, 29, 27, 0.1)',
  'inset': 'inset 0 2px 4px rgba(29, 29, 27, 0.06)',
}
```

---

## 5. UI Components

### Cards

```html
<div class="card-ledger corner-flourish p-6">
  <h2 class="section-header mb-6">Section Title</h2>
  <!-- Content -->
</div>
```

Cards feature:
- Ivory background (`ivory-50`)
- Subtle border (`charcoal-200/40`)
- Ledger shadow
- Brass accent gradient on left edge
- Corner flourishes (decorative brass corners)
- Hover lift effect (`translateY(-1px)`)

### Corner Flourishes

Decorative brass-colored corner brackets on cards:

```css
.corner-flourish {
  position: relative;
}
.corner-flourish::before,
.corner-flourish::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: rgba(201, 162, 39, 0.3);
  border-style: solid;
  pointer-events: none;
}
.corner-flourish::before {
  top: -1px;
  left: -1px;
  border-width: 2px 0 0 2px;
}
.corner-flourish::after {
  bottom: -1px;
  right: -1px;
  border-width: 0 2px 2px 0;
}
```

### Buttons

#### Primary Button

```html
<button class="btn-primary">Action Label</button>
```

```css
.btn-primary {
  @apply relative px-6 py-3 font-body text-sm font-medium tracking-wide;
  @apply bg-forest-800 text-ivory-100;
  @apply transition-all duration-300 ease-out;
  @apply shadow-emboss;
  overflow: hidden;
}

/* Brass highlight on hover */
.btn-primary::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(201, 162, 39, 0.5), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}
.btn-primary:hover::before {
  opacity: 1;
}
.btn-primary:hover {
  @apply bg-forest-700;
  transform: translateY(-1px);
}
.btn-primary:disabled {
  @apply bg-charcoal-200 text-charcoal-400 cursor-not-allowed shadow-none;
}
```

#### Secondary Button

```html
<button class="btn-secondary">Secondary Action</button>
```

```css
.btn-secondary {
  @apply px-6 py-3 font-body text-sm font-medium tracking-wide;
  @apply border border-charcoal-300 text-charcoal-700 bg-transparent;
  @apply transition-all duration-300 ease-out;
}
.btn-secondary:hover {
  @apply border-forest-600 text-forest-800 bg-forest-50;
}
```

#### Ghost Button (Links)

```html
<a class="btn-ghost group">
  Link Text
  <svg class="transition-transform group-hover:translate-x-1">...</svg>
</a>
```

```css
.btn-ghost {
  @apply font-body text-sm text-charcoal-500 transition-colors duration-200;
}
.btn-ghost:hover {
  @apply text-forest-800;
}
```

### Badges

```html
<span class="badge badge-positive">Active</span>
<span class="badge badge-negative">Past due</span>
<span class="badge badge-brass">Trial</span>
<span class="badge badge-neutral">Canceled</span>
```

```css
.badge {
  @apply inline-flex items-center px-2 py-0.5 text-xs font-body tracking-wide;
}
.badge-positive {
  @apply bg-forest-100 text-forest-800 border border-forest-200;
}
.badge-negative {
  @apply bg-burgundy-100 text-burgundy-700 border border-burgundy-200;
}
.badge-brass {
  @apply bg-brass-100 text-brass-800 border border-brass-300;
}
.badge-neutral {
  @apply bg-charcoal-100 text-charcoal-700 border border-charcoal-200;
}
```

### Notices/Alerts

```html
<div class="notice-warning">
  <p class="font-body text-sm text-brass-800">Warning message</p>
</div>

<div class="notice-danger">
  <p class="font-body text-sm text-burgundy-800">Error message</p>
</div>

<div class="notice-info">
  <p class="font-body text-sm text-forest-800">Info message</p>
</div>
```

```css
.notice-warning {
  @apply py-3 px-4 bg-brass-50 border-l-2 border-brass-500;
}
.notice-danger {
  @apply py-3 px-4 bg-burgundy-50 border-l-2 border-burgundy-600;
}
.notice-info {
  @apply py-3 px-4 bg-forest-50 border-l-2 border-forest-600;
}
```

### Dividers

```html
<div class="divider-brass"></div>
```

```css
.divider-brass {
  @apply relative h-px w-full bg-charcoal-200/50;
}
.divider-brass::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, rgba(201, 162, 39, 0.5), transparent);
}
```

### Credit Indicators

```html
<span class="credit-positive">+5</span>
<span class="credit-negative">-1</span>
```

```css
.credit-positive {
  @apply text-forest-700 font-mono font-medium;
}
.credit-negative {
  @apply text-burgundy-600 font-mono font-medium;
}
```

---

## 6. Animations

### Keyframes

```typescript
// tailwind.config.ts
animation: {
  'fade-in': 'fadeIn 0.5s ease-out forwards',
  'slide-up': 'slideUp 0.5s ease-out forwards',
  'scale-in': 'scaleIn 0.3s ease-out forwards',
  'glow': 'glow 2s ease-in-out infinite',
},
keyframes: {
  fadeIn: {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },
  slideUp: {
    '0%': { opacity: '0', transform: 'translateY(16px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  scaleIn: {
    '0%': { opacity: '0', transform: 'scale(0.95)' },
    '100%': { opacity: '1', transform: 'scale(1)' },
  },
  glow: {
    '0%, 100%': { boxShadow: '0 0 0 rgba(201, 162, 39, 0)' },
    '50%': { boxShadow: '0 0 20px rgba(201, 162, 39, 0.15)' },
  },
},
```

### Staggered Page Load

Use stagger classes for orchestrated reveals:

```html
<div class="opacity-0 animate-slide-up stagger-1">First card</div>
<div class="opacity-0 animate-slide-up stagger-2">Second card</div>
<div class="opacity-0 animate-slide-up stagger-3">Third card</div>
```

```css
.stagger-1 { animation-delay: 0.05s; }
.stagger-2 { animation-delay: 0.1s; }
.stagger-3 { animation-delay: 0.15s; }
.stagger-4 { animation-delay: 0.2s; }
.stagger-5 { animation-delay: 0.25s; }
.stagger-6 { animation-delay: 0.3s; }
```

### Button Glow

Primary buttons have a subtle brass glow animation when active:

```html
<button class="btn-primary animate-glow">Use Credit</button>
```

### Loading Spinner

```html
<div class="w-12 h-12 rounded-full border-2 border-forest-200 border-t-forest-600 animate-spin"></div>
```

---

## 7. Layout Patterns

### Page Container

```html
<div class="max-w-5xl mx-auto px-6 py-12">
  <!-- Page content -->
</div>
```

### Page Header

```html
<header class="flex justify-between items-center mb-12 opacity-0 animate-fade-in">
  <div>
    <h1 class="font-display text-4xl font-semibold text-forest-800 tracking-tight">
      Page Title
    </h1>
    <p class="font-body text-charcoal-500 mt-1">
      Page description
    </p>
  </div>
  <a href="/" class="btn-ghost group flex items-center gap-2">
    <svg class="w-4 h-4 transition-transform group-hover:-translate-x-1">...</svg>
    <span>Back to Dashboard</span>
  </a>
</header>
```

### Two-Column Grid

```html
<div class="grid md:grid-cols-2 gap-6">
  <div class="card-ledger corner-flourish p-6">...</div>
  <div class="card-ledger corner-flourish p-6">...</div>
</div>
```

### Three-Column Grid (Pricing)

```html
<div class="grid md:grid-cols-3 gap-6">
  <div class="card-ledger p-6">...</div>
  <div class="card-ledger p-6 ring-2 ring-brass-400"><!-- Popular --></div>
  <div class="card-ledger p-6">...</div>
</div>
```

### Page Footer

```html
<footer class="mt-16 pt-8 border-t border-charcoal-100 opacity-0 animate-fade-in stagger-6">
  <div class="flex justify-between items-center text-charcoal-400">
    <p class="font-body text-xs">App Name</p>
    <div class="flex items-center gap-1">
      <div class="w-2 h-2 rounded-full bg-forest-400 animate-pulse"></div>
      <span class="font-body text-xs">All systems operational</span>
    </div>
  </div>
</footer>
```

---

## 8. Icons

Use Heroicons (outline style, 1.5 or 2 stroke width). Icons should be contextual:

```html
<!-- Lightning bolt for actions/credits -->
<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
</svg>

<!-- Refresh for renewals -->
<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
</svg>

<!-- Plus for purchases/additions -->
<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
</svg>

<!-- Warning triangle for errors -->
<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
</svg>

<!-- Arrow right for navigation -->
<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
</svg>

<!-- Check for success -->
<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
</svg>
```

Icon containers (circular backgrounds):

```html
<!-- Positive context -->
<div class="w-10 h-10 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center">
  <svg>...</svg>
</div>

<!-- Negative context -->
<div class="w-10 h-10 rounded-full bg-burgundy-100 text-burgundy-600 flex items-center justify-center">
  <svg>...</svg>
</div>

<!-- Neutral context -->
<div class="w-10 h-10 rounded-full bg-charcoal-100 text-charcoal-500 flex items-center justify-center">
  <svg>...</svg>
</div>

<!-- Brass/highlight context -->
<div class="w-10 h-10 rounded-full bg-brass-100 text-brass-700 flex items-center justify-center">
  <svg>...</svg>
</div>
```

---

## 9. Component Templates

### Metric Card

```html
<div class="card-ledger corner-flourish p-6 opacity-0 animate-slide-up stagger-1">
  <h2 class="section-header mb-6">Metric Name</h2>

  <div class="mb-8">
    <div class="flex items-baseline gap-3">
      <span class="display-number">42</span>
      <span class="font-body text-charcoal-400 tracking-wide">unit label</span>
    </div>
    <div class="mt-2 h-1 w-24 bg-gradient-to-r from-brass-400 to-brass-200 rounded-full"></div>
  </div>

  <div class="space-y-3">
    <div class="flex justify-between items-center py-2 border-b border-charcoal-100">
      <span class="font-body text-sm text-charcoal-500">Label</span>
      <span class="font-mono text-sm font-medium text-forest-800">Value</span>
    </div>
  </div>
</div>
```

### List Item with Action

```html
<div class="flex items-center justify-between py-4 border-b border-charcoal-100">
  <div class="flex items-center gap-4">
    <div class="w-10 h-10 rounded-full bg-brass-100 border border-brass-200 flex items-center justify-center text-brass-700">
      <svg>...</svg>
    </div>
    <div>
      <div class="font-display text-lg font-semibold text-charcoal-800">Item Name</div>
      <div class="font-body text-sm text-charcoal-500">Description</div>
    </div>
  </div>
  <button class="btn-secondary">Action</button>
</div>
```

### Status with Icon Badge

```html
<div class="flex items-center gap-4">
  <div class="w-12 h-12 rounded-full bg-forest-100 border border-forest-200 flex items-center justify-center text-forest-700">
    <svg class="w-5 h-5">...</svg>
  </div>
  <div>
    <div class="font-display text-2xl font-semibold text-forest-800">Title</div>
    <span class="badge badge-positive">Status</span>
  </div>
</div>
```

### Activity Entry

```html
<div class="flex items-center justify-between py-3 border-b border-charcoal-100">
  <div class="flex items-center gap-3">
    <div class="w-7 h-7 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center">
      <svg class="w-3.5 h-3.5">...</svg>
    </div>
    <div>
      <span class="font-body text-sm text-charcoal-800">Event Label</span>
      <span class="font-body text-xs text-charcoal-400 ml-2">2h ago</span>
    </div>
  </div>
  <span class="credit-positive">+5</span>
</div>
```

---

## 10. Responsive Breakpoints

```css
/* Mobile first */
@media (min-width: 768px) {  /* md: */
  .grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) { /* lg: */
  .grid { grid-template-columns: repeat(3, 1fr); }
}
```

Standard Tailwind breakpoints:
- **Mobile**: < 768px (single column)
- **Tablet**: 768px+ (2 columns, `md:grid-cols-2`)
- **Desktop**: 1024px+ (3 columns for pricing, `lg:grid-cols-3`)

---

## 11. Selection & Focus States

```css
::selection {
  @apply bg-forest-800 text-ivory-100;
}

/* Focus visible for accessibility */
a:focus-visible,
button:focus-visible {
  outline: 2px solid var(--forest-800);
  outline-offset: 2px;
}
```

---

## 12. Toast Notifications

```html
<div class="fixed bottom-6 right-6 px-4 py-3 bg-forest-800 text-ivory-100 shadow-ledger-hover animate-slide-up">
  <div class="flex items-center gap-3">
    <div class="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
      <svg><!-- Check icon --></svg>
    </div>
    <span class="font-body text-sm">Success message</span>
    <button class="text-ivory-300 hover:text-ivory-100">
      <svg><!-- X icon --></svg>
    </button>
  </div>
</div>
```

Toast backgrounds by type:
- **Success**: `bg-forest-800`
- **Error**: `bg-burgundy-700`
- **Info**: `bg-charcoal-700`

---

## 13. Quick Reference: Tailwind Classes

### Common Patterns

```
# Page title
font-display text-4xl font-semibold text-forest-800 tracking-tight

# Section header
section-header mb-6

# Large number display
display-number

# Card container
card-ledger corner-flourish p-6 opacity-0 animate-slide-up stagger-N

# Primary button
btn-primary

# Secondary button
btn-secondary

# Ghost link
btn-ghost group

# Positive credit
credit-positive

# Negative credit
credit-negative

# Notices
notice-warning / notice-danger / notice-info

# Badges
badge badge-positive / badge-negative / badge-brass / badge-neutral

# Divider
divider-brass
```

---

## 14. Do's and Don'ts

### Do

- Use `font-display` (Cormorant Garamond) for headings and tier names
- Use `font-mono` (JetBrains Mono) for all numbers and data
- Use brass accents sparingly for highlights and decoration
- Include staggered animations on page load
- Use corner flourishes on main content cards
- Show credit changes with color coding (forest = positive, burgundy = negative)
- Include subtle hover states on all interactive elements

### Don't

- Don't use generic sans-serif fonts
- Don't use blue/purple color schemes
- Don't use fully rounded corners (max 4px for small elements)
- Don't use flat shadows - always use the ledger shadow system
- Don't overuse brass - it should be an accent, not dominant
- Don't skip the paper texture on backgrounds
- Don't use generic loading spinners - use the forest-colored ring spinner
