# CRM Pro Dashboard - Frontend Design System Document

## 1. UI Design System

### 1.1 Color Palette

The design uses a limited, cohesive color palette optimized for dark glassmorphism UI:

| Token | Value | Usage |
|-------|-------|-------|
| **Primary Text** | `text-white` | Headings, primary content |
| **Secondary Text** | `text-white/80` | Labels, navigation items |
| **Muted Text** | `text-white/60` | Descriptions, timestamps |
| **Subtle Text** | `text-white/40` | Placeholders |

#### Accent Colors
| Color | Class | Usage |
|-------|-------|-------|
| Blue | `text-blue-400`, `bg-blue-500/20` | Stats, prospect badges, info indicators |
| Green | `text-green-400`, `bg-green-500/20` | Success states, active badges, positive metrics |
| Yellow | `text-yellow-400`, `bg-yellow-500/20` | Revenue highlights, warnings, premium features |
| Purple | `text-purple-400`, `bg-purple-500/20` | Meeting stats, premium accents |
| Orange | `text-orange-500` | Premium gradients, CTA buttons |

#### Background Colors
| Pattern | Usage |
|---------|-------|
| `bg-white/5` | Subtle card backgrounds, list items |
| `bg-white/10` | Primary glass cards, buttons |
| `bg-white/15` | Hover states for cards |
| `bg-white/20` | Active navigation, elevated elements |
| `bg-black/30` | Overlay on background image |

### 1.2 Typography

**Font Family:** Figtree (Google Font)
- Variable: `--font-figtree`
- Fallback: System sans-serif stack

**Type Scale:**
| Element | Classes | Usage |
|---------|---------|-------|
| H1 | `text-2xl font-bold` | Logo, main headings |
| H2 | `text-3xl font-bold` | Page title |
| H3 | `text-xl font-semibold` | Card headers |
| H4 | `text-lg font-semibold` | Section headers |
| Body | `text-base` | Navigation items |
| Small | `text-sm` | Labels, descriptions |
| XSmall | `text-xs` | Timestamps, badges |

**Font Weights:**
- `font-bold` (700) - Headings, values
- `font-semibold` (600) - Section titles
- `font-medium` (500) - Emphasis text
- Default (400) - Body text

### 1.3 Spacing System

Based on Tailwind's default 4px scale:

| Token | Value | Usage |
|-------|-------|-------|
| `p-2` | 8px | Small buttons, tight spacing |
| `p-3` | 12px | List item padding |
| `p-4` | 16px | Inner card sections |
| `p-6` | 24px | Card padding |
| `p-8` | 32px | Large banner padding |
| `gap-2` | 8px | Tight element spacing |
| `gap-3` | 12px | List spacing |
| `gap-4` | 16px | Button groups |
| `gap-6` | 24px | Card grid gaps |
| `space-y-2` | 8px | Vertical nav items |
| `space-y-3` | 12px | Progress bars |
| `space-y-4` | 16px | Contact list items |
| `space-y-6` | 24px | Major sections |

### 1.4 Glassmorphism / Frosted Glass Effects

**Core Glass Pattern:**
```css
backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl
```

**Glass Variations:**

| Variant | Classes | Usage |
|---------|---------|-------|
| Primary Card | `backdrop-blur-xl bg-white/10 border-white/20` | Main content cards |
| Nested Card | `backdrop-blur-xl bg-white/10 border-white/20 rounded-2xl` | Cards within cards |
| List Item | `bg-white/5 border-white/10 rounded-xl` | Contact rows, activity items |
| Active State | `bg-white/20 border-white/30` | Active navigation |
| Premium Card | `bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-400/30` | Upgrade prompts |

### 1.5 Shadows, Gradients & Transparency Rules

**Gradients Used:**

| Type | Classes | Usage |
|------|---------|-------|
| Progress Bar | `bg-gradient-to-r from-green-400 to-blue-500` | Monthly target |
| Progress Bar | `bg-gradient-to-r from-yellow-400 to-orange-500` | Quarterly target |
| Team Progress | `bg-gradient-to-r from-blue-400 to-purple-500` | Team A |
| Team Progress | `bg-gradient-to-r from-green-400 to-teal-500` | Team B |
| Team Progress | `bg-gradient-to-r from-orange-400 to-red-500` | Team C |
| Premium CTA | `bg-gradient-to-r from-yellow-500 to-orange-500` | Upgrade buttons |

**Transparency Scale:**
- `/5` - Subtle backgrounds (5% opacity)
- `/10` - Default glass (10% opacity)
- `/20` - Elevated/active (20% opacity)
- `/30` - Borders, overlays (30% opacity)
- `/40` - Focus states (40% opacity)
- `/60` - Muted text (60% opacity)
- `/80` - Secondary text (80% opacity)

**Shadow:** None explicitly used - glassmorphism relies on backdrop blur and border effects

### 1.6 Border Radius System

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-full` | 9999px | Avatars, progress bars, pills |
| `rounded-3xl` | 24px | Primary cards |
| `rounded-2xl` | 16px | Nested cards, buttons |
| `rounded-xl` | 12px | List items, inputs |

---

## 2. Component Architecture

### 2.1 Reusable UI Components

**From shadcn/ui:**
| Component | Import Path | Purpose |
|-----------|-------------|---------|
| `Card` | `@/components/ui/card` | Glass container component |
| `Button` | `@/components/ui/button` | Interactive buttons |
| `Input` | `@/components/ui/input` | Search and form inputs |
| `Badge` | `@/components/ui/badge` | Status indicators |
| `Avatar` | `@/components/ui/avatar` | User profile images |

**Icon Library:** Lucide React
- 25+ icons used for navigation, actions, and decoration

### 2.2 Component Hierarchy

```
CRMDashboard (Root)
├── Background Layer
│   ├── Background Image
│   └── Dark Overlay (bg-black/30)
│
├── Left Sidebar (col-span-2)
│   ├── Logo Section
│   ├── Main Menu Navigation
│   │   └── NavItem[] (Contacts, Analytics, Sales, Calendar, Campaigns)
│   ├── CRM Tools Navigation
│   │   └── NavItem[] (Reports, Deals, Messages, Data Import, Forecasting)
│   ├── Administration Navigation
│   │   └── NavItem[] (Settings, Automations)
│   ├── Premium Upgrade Card
│   └── Footer Actions (Support, Logout)
│
├── Main Content (col-span-8)
│   ├── Header Card
│   │   ├── Title & Subtitle
│   │   ├── Search Input
│   │   ├── Notification Button
│   │   └── Add Contact Button
│   │
│   ├── Stats Grid (4 columns)
│   │   └── StatCard[] (Contacts, Deals, Revenue, Meetings)
│   │
│   ├── Two-Column Grid
│   │   ├── Recent Contacts Card
│   │   │   ├── Header with Filter/Export
│   │   │   └── ContactList[]
│   │   │       └── ContactRow (Avatar, Info, Value, Status Badge)
│   │   │
│   │   └── Sales Target Card
│   │       ├── Monthly Progress Bar
│   │       ├── Quarterly Progress Bar
│   │       ├── Team Performance[]
│   │       └── Days Remaining Counter
│   │
│   └── Premium Banner Card
│       ├── Icon & Copy
│       ├── Feature List
│       └── Pricing & CTA
│
├── Right Sidebar (col-span-2)
│   ├── Quick Actions
│   │   └── ActionButton[] (Call, Email, Meeting, Note)
│   ├── AI Chat Card (Xperia)
│   ├── Recent Activity
│   │   └── ActivityItem[]
│   └── Top Performers
│       └── PerformerRow[]
│
└── Footer Attribution (Fixed)
```

### 2.3 Component Patterns

**Navigation Button Pattern:**
```tsx
<Button
  variant="ghost"
  className={`w-full justify-start text-base text-white/80 
    hover:bg-white/10 hover:text-white 
    transition-all duration-700 ease-out hover:scale-[1.02] h-11
    ${active ? "bg-white/20 text-white border border-white/30" : ""}`}
>
  <Icon className="mr-3 h-5 w-5" />
  {label}
</Button>
```

**Stat Card Pattern:**
```tsx
<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 
  transition-all duration-700 ease-out hover:scale-[1.02] hover:bg-white/15">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-white/60 text-sm">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className={`text-sm ${color}`}>{change}</p>
    </div>
    <Icon className={`h-8 w-8 ${color}`} />
  </div>
</Card>
```

**Progress Bar Pattern:**
```tsx
<div className="w-full bg-white/10 rounded-full h-3">
  <div
    className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full"
    style={{ width: `${progress}%` }}
  />
</div>
```

---

## 3. Layout Structure

### 3.1 Overall Layout

**Grid System:** CSS Grid with 12 columns
```tsx
<div className="grid grid-cols-12 gap-6 h-screen">
  <aside className="col-span-2">...</aside>  {/* Left Sidebar */}
  <main className="col-span-8">...</main>    {/* Main Content */}
  <aside className="col-span-2">...</aside>  {/* Right Sidebar */}
</div>
```

### 3.2 Sidebar Layout

**Left Sidebar (col-span-2):**
- Fixed height with `h-fit`
- Internal spacing: `space-y-6`
- Padding: `p-6`
- Flex column with sticky footer

**Right Sidebar (col-span-2):**
- Fixed height with `h-fit`
- Internal spacing: `space-y-6`
- Padding: `p-6`

### 3.3 Dashboard Grid Systems

**Stats Grid:**
```tsx
<div className="grid grid-cols-4 gap-6">
  {/* 4 equal-width stat cards */}
</div>
```

**Content Grid:**
```tsx
<div className="grid grid-cols-2 gap-6">
  {/* Recent Contacts | Sales Target */}
</div>
```

### 3.4 Card Component Variations

| Type | Border Radius | Padding | Usage |
|------|---------------|---------|-------|
| Primary | `rounded-3xl` | `p-6` | Main content cards |
| Nested | `rounded-2xl` | `p-4` | Cards within cards |
| List Item | `rounded-xl` | `p-3` or `p-4` | Contact rows, activities |
| Pill | `rounded-full` | `px-6 py-2` | Footer attribution |

### 3.5 Responsive Behavior

Currently optimized for desktop (1440px+). For responsive design, implement:

```css
/* Mobile: Stack all columns */
@media (max-width: 768px) {
  .grid-cols-12 → grid-cols-1
  .col-span-2 → col-span-1 (hidden on mobile or drawer)
  .col-span-8 → col-span-1
}

/* Tablet: Two columns */
@media (max-width: 1024px) {
  .grid-cols-4 → grid-cols-2
  Hide right sidebar
}
```

---

## 4. Styling Implementation

### 4.1 CSS/Tailwind Structure

**Base Styles (globals.css):**
- Tailwind CSS v4 with `@import "tailwindcss"`
- Animation utilities via `tw-animate-css`
- CSS custom properties for theming
- Font variable: `--font-figtree`

### 4.2 Utility Class Patterns

**Glass Effect Composition:**
```css
/* Standard glass card */
backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl

/* Elevated glass */
backdrop-blur-xl bg-white/20 border border-white/30 rounded-2xl

/* Subtle container */
bg-white/5 border border-white/10 rounded-xl
```

**Transition Pattern:**
```css
transition-all duration-700 ease-out hover:scale-[1.02]
```

**Text Hierarchy:**
```css
/* Primary heading */
text-white font-bold

/* Secondary heading */
text-white font-semibold

/* Body text */
text-white/80

/* Muted text */
text-white/60

/* Placeholder */
text-white/40
```

### 4.3 Reusable Style Tokens

```tsx
// Glass card base
const glassCard = "backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl"

// Glass button
const glassButton = "bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white transition-all duration-700 ease-out hover:scale-[1.02]"

// Nav item
const navItem = "w-full justify-start text-base text-white/80 hover:bg-white/10 hover:text-white transition-all duration-700 ease-out hover:scale-[1.02] h-11"

// Active nav item
const navItemActive = "bg-white/20 text-white border border-white/30"

// List item
const listItem = "bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300"
```

---

## 5. Folder Structure Recommendation

```
/
├── app/
│   ├── globals.css          # Global styles, CSS variables
│   ├── layout.tsx           # Root layout with font config
│   └── page.tsx             # Entry point
│
├── components/
│   ├── ui/                  # shadcn/ui primitives
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── input.tsx
│   │
│   ├── dashboard/           # Dashboard-specific components
│   │   ├── header.tsx       # Dashboard header with search
│   │   ├── stat-card.tsx    # Metric display card
│   │   ├── contact-list.tsx # Contact list with rows
│   │   ├── contact-row.tsx  # Individual contact item
│   │   ├── sales-target.tsx # Sales progress card
│   │   ├── progress-bar.tsx # Reusable progress bar
│   │   ├── activity-feed.tsx# Recent activity list
│   │   └── performers.tsx   # Top performers list
│   │
│   ├── navigation/          # Navigation components
│   │   ├── sidebar.tsx      # Left sidebar container
│   │   ├── nav-section.tsx  # Grouped nav items
│   │   ├── nav-item.tsx     # Single nav button
│   │   └── right-sidebar.tsx# Right sidebar container
│   │
│   ├── cards/               # Specialized cards
│   │   ├── premium-card.tsx # Upgrade promotion
│   │   ├── ai-card.tsx      # AI assistant card
│   │   └── quick-actions.tsx# Action buttons card
│   │
│   └── layout/              # Layout wrappers
│       ├── glass-card.tsx   # Reusable glass container
│       └── page-wrapper.tsx # Background + overlay
│
├── lib/
│   ├── utils.ts             # cn() and utilities
│   └── styles.ts            # Style token constants
│
├── styles/                  # Additional styles (if needed)
│   └── animations.css       # Custom animations
│
├── types/
│   └── index.ts             # TypeScript interfaces
│
└── public/
    └── images/
        └── crm-background.png
```

---

## 6. Design Tokens

### 6.1 CSS Custom Properties

```css
:root {
  /* Glassmorphism */
  --glass-blur: blur(24px);              /* backdrop-blur-xl */
  --glass-bg: rgba(255, 255, 255, 0.1);  /* bg-white/10 */
  --glass-border: rgba(255, 255, 255, 0.2); /* border-white/20 */
  --glass-elevated-bg: rgba(255, 255, 255, 0.2);
  --glass-elevated-border: rgba(255, 255, 255, 0.3);
  
  /* Typography */
  --font-family: var(--font-figtree), system-ui, sans-serif;
  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-base: 1rem;    /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.25rem;   /* 20px */
  --font-size-2xl: 1.5rem;   /* 24px */
  --font-size-3xl: 1.875rem; /* 30px */
  
  /* Spacing */
  --spacing-1: 0.25rem;  /* 4px */
  --spacing-2: 0.5rem;   /* 8px */
  --spacing-3: 0.75rem;  /* 12px */
  --spacing-4: 1rem;     /* 16px */
  --spacing-6: 1.5rem;   /* 24px */
  --spacing-8: 2rem;     /* 32px */
  
  /* Border Radius */
  --radius-xl: 0.75rem;  /* 12px - rounded-xl */
  --radius-2xl: 1rem;    /* 16px - rounded-2xl */
  --radius-3xl: 1.5rem;  /* 24px - rounded-3xl */
  --radius-full: 9999px;
  
  /* Transitions */
  --transition-duration: 700ms;
  --transition-timing: ease-out;
  --hover-scale: 1.02;
  
  /* Colors - Text */
  --color-text-primary: rgba(255, 255, 255, 1);
  --color-text-secondary: rgba(255, 255, 255, 0.8);
  --color-text-muted: rgba(255, 255, 255, 0.6);
  --color-text-subtle: rgba(255, 255, 255, 0.4);
  
  /* Colors - Accent */
  --color-blue: #60a5fa;     /* blue-400 */
  --color-green: #4ade80;    /* green-400 */
  --color-yellow: #facc15;   /* yellow-400 */
  --color-purple: #c084fc;   /* purple-400 */
  --color-orange: #f97316;   /* orange-500 */
  --color-red: #f87171;      /* red-400 */
  --color-teal: #2dd4bf;     /* teal-400 */
  
  /* Status Colors */
  --status-active: var(--color-green);
  --status-prospect: var(--color-blue);
  --status-inactive: #9ca3af; /* gray-400 */
  --status-success: var(--color-green);
  --status-info: var(--color-blue);
}
```

### 6.2 Tailwind Theme Extension

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-figtree)', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        'glass': '24px',
      },
      borderRadius: {
        'glass': '24px',
        'glass-inner': '16px',
        'glass-item': '12px',
      },
      transitionDuration: {
        'glass': '700ms',
      },
      scale: {
        'hover': '1.02',
      },
      colors: {
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.1)',
          elevated: 'rgba(255, 255, 255, 0.2)',
          subtle: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.2)',
          'border-elevated': 'rgba(255, 255, 255, 0.3)',
        }
      }
    }
  }
}
```

---

## 7. Animation & Interaction Patterns

### 7.1 Hover Transitions

**Standard Card Hover:**
```css
transition-all duration-700 ease-out hover:scale-[1.02] hover:bg-white/15
```

**Button Hover:**
```css
transition-all duration-700 ease-out hover:scale-[1.02]
hover:bg-white/20 hover:border-white/30
```

**List Item Hover:**
```css
transition-all duration-300 hover:bg-white/10
```

### 7.2 Focus States

**Input Focus:**
```css
focus:border-white/40 focus:bg-white/10
```

### 7.3 Active States

**Navigation Active:**
```css
bg-white/20 text-white border border-white/30
```

---

## 8. Accessibility Considerations

### 8.1 Color Contrast
- Primary text (`text-white`) on glass backgrounds provides sufficient contrast
- Consider adding `sr-only` labels for icon-only buttons
- Ensure color is not the only indicator for status badges

### 8.2 Interactive Elements
- All buttons have visible focus states
- Hover states provide visual feedback
- Consider keyboard navigation for sidebar

### 8.3 Recommendations
- Add `aria-label` to icon buttons
- Implement `role="navigation"` for sidebar sections
- Add `aria-current="page"` for active nav items
- Ensure proper heading hierarchy (h1 → h2 → h3)

---

*Document Version: 1.0*  
*Last Updated: March 2026*  
*Based on CRM Pro Dashboard by Dollar Gill*
