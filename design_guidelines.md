# Design Guidelines: Achadinhos do Dia

## Design Approach
**User-Specified Design**: Fun, modern affiliate product catalog with a vibrant, playful aesthetic inspired by social shopping feeds. The design prioritizes simplicity, speed, and visual appeal with a distinctly Brazilian e-commerce personality.

## Core Design Elements

### A. Color Palette

**Primary Colors:**
- Pink: #FF66B3 (playful, energetic accent)
- Orange: #FFA64D (warm, inviting secondary)
- Blue: #5AC8FA (fresh, trustworthy tertiary)

**Background:**
- Base: White or soft beige (neutral, clean foundation)

**Usage:**
- Category buttons and CTAs use the primary color trio
- Hover states intensify the existing colors
- Product cards maintain light backgrounds with colored accents

### B. Typography

**Font Family:**
- Primary: "Poppins" or "Quicksand" from Google Fonts
- Both are rounded, friendly typefaces that reinforce the playful brand personality

**Hierarchy:**
- Header/Logo: Bold, large scale for "Achadinhos do Dia"
- Slogan: Medium weight, smaller than header
- Product names: Semibold, concise (short names)
- Prices: Bold, prominent for quick scanning
- Buttons: Medium weight, clear call-to-action text

### C. Layout System

**Spacing Primitives:**
- Use consistent Tailwind units: 2, 4, 6, 8, 12, 16, 20, 24 for rhythm
- Cards: p-4 to p-6 internal padding
- Sections: py-12 to py-20 vertical spacing
- Grid gaps: gap-4 to gap-6 between cards

**Container:**
- Max width: max-w-7xl for main content area
- Responsive padding: px-4 on mobile, px-8 on desktop

### D. Component Library

**Header:**
- Site name "Achadinhos do Dia" with emoji/icon accent
- Slogan: "Garimpei pra você — só o que vale a pena!"
- Clean, centered layout with generous vertical padding

**Category Filter Bar:**
- Horizontal scrollable pills/buttons
- Categories: "Beleza 💄", "Tech ⚙️", "Casa 🏠", "Moda 👗", "Pets 🐾"
- Active state: filled background with primary color
- Inactive: outline or subtle background

**Featured Card (Achadinho do Dia):**
- Larger hero card at top of grid
- Prominent placement with special visual treatment
- 2x size of regular cards or full-width spotlight
- Special badge/tag identifying it as featured

**Product Cards:**
- Rounded corners (border-radius: 12px-16px)
- Light shadow at rest: shadow-sm to shadow-md
- Hover effect: elevate with shadow-lg and subtle scale (1.02)
- Structure: Image top, name, price, "Ver Oferta" button stacked
- Images: aspect-ratio 1:1 or 4:3, object-cover
- Button: Colorful (rotating pink/orange/blue), full-width, rounded

**Grid Layout:**
- Mobile: 1 column (grid-cols-1)
- Tablet: 2 columns (md:grid-cols-2)
- Desktop: 3-4 columns (lg:grid-cols-3 xl:grid-cols-4)
- 8-12 products displayed

**Footer:**
- Simple, centered text
- Message: "Achadinhos garimpados com 💖 — ao comprar, você me ajuda a continuar achando mais ofertas incríveis!"
- Soft background with ample padding

### E. Interactions

**Card Hover States:**
- Smooth transform: transition-all duration-300
- Shadow elevation: shadow-sm → shadow-lg
- Subtle scale: scale-105
- Button color intensifies

**Category Filters:**
- Click to filter products by category
- Visual feedback: active state with filled background
- Smooth transition between states

**Links:**
- "Ver Oferta" buttons redirect to affiliate URLs
- No page reload, direct external navigation

## Images

**Product Images:**
- Each card requires a product image (user-provided URLs)
- Aspect ratio: Square (1:1) or landscape (4:3)
- Display: object-cover to fill container
- Quality: Optimized web images for fast loading

**No Hero Image:**
- Site uses colorful header with typography instead
- Focus on immediate product catalog visibility
- Featured card serves as visual anchor

## Additional Notes

- Lightweight, fast-loading design (vanilla HTML/CSS/JS)
- Fully responsive across all devices
- No authentication or user accounts
- Products loaded from productos.js JSON structure
- Emoji integration in category labels for personality
- Modern CSS (Flexbox and Grid) for layouts
- Affiliate-friendly with clear CTAs and product focus