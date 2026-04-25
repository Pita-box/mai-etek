PATTERN: Cyber-Premium AI SaaS
"Conversion: High-tech authority, speed-driven, minimalist prestige"
"CTA: Focused center-aligned hero, glass buttons with hover glow"
Sections:
1. Hero (Massive typography + Product Preview)
2. Social Proof (Grayscale logos, low opacity)
3. Feature Grid (Glassmorphism cards)
4. Interactive Dashboard Preview
5. Tiered Pricing (Obsidian cards with accent highlight)

STYLE: Obsidian Glassmorphism
"Keywords: Deep space, sharp, electric accents, translucent, layered depth"
"Best For: AI tools, Developer tools, FinTech, Crypto, High-end SaaS"
Performance: High (requires GPU for blurs) | Accessibility: Contrast 7:1 focus

COLORS:
Background: #000000 (Pure Black)
"Card BG: rgba(255, 255, 255, 0.07) + Backdrop-blur (12-20px)"
Backgground radial gradient {
    background: radial-gradient(circle, #ff1f5759 0%, #0000 50%);
}
inputs dark background-color: color-mix(in oklab, var(--input) 60%, transparent)
glass-cards background: #00000094
glass-card on hover: #000000ba
Accent: bg-rose-700

 (Electric Crimson)
"Border: rgba(255, 255, 255, 0.1) (Ultra-thin 1px)"
Text Primary: #FFFFFF (Pure White)
Text Muted: #7a7879
"Notes: Use radial gradients (#FF1F57 at 15% opacity) for background ""aura"""

TYPOGRAPHY: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
"Headings: Weight 600 (Semi-bold), Letter-spacing: -0.04em, Line-height: 1.1"
"Body: Weight 400 (Regular), Letter-spacing: -0.01em, Color: #A1A1AA"
Code/Labels: JetBrains Mono (for tech feel)

KEY EFFECTS & UI SPECS:
"Borders: 1px solid rgba(255, 255, 255, 0.1)"
"Corner Radius: 16px (Main cards), 12px (Inner components), 999px (Pills)"
"Glows: Inner-glow on hover (0 0 15px rgba(255, 31, 87, 0.2))"
"Transitions: 400ms Cubic-bezier(0.4, 0, 0.2, 1)"
Buttons on hover has glow effect.
All clickable elements has cursor-pointer.
Shadows: None (use borders and blurs to define depth instead)

AVOID (Anti-patterns):
❌ Standard Drop Shadows (use glow or borders)
❌ Bright Blue/Green accents (stick to Red/Pink/Purple spectrum)
"❌ Rounded ""bubbly"" buttons (keep them sleek and slightly squared/pill-shaped)"
❌ Heavy textures (keep it smooth and digital)

PRE-DELIVERY CHECKLIST:
[ ] Background is #000000 (not dark gray)
[ ] All glass cards have backdrop-filter: blur(16px)
[ ] Primary CTA has a subtle gradient pulse
[ ] Logo wall is strictly monochrome (opacity 0.4)
[ ] Font tracking (letter-spacing) is negative on all headlines
[ ] Mobile: Blur effects reduced for performance optimization