

## Overview

This plan covers four major changes: removing the Affiliate section, adding an Explainable AI service, enhancing the hero headline and overall UX (inspired by Heidi Health and Lyrebird Health's clean, centered, typographic style), and replacing the static blog with real clickable articles linking to external sources.

---

## 1. Remove Affiliate Section

**Files affected:** `src/App.tsx`, `src/components/Navbar.tsx`, `src/components/Footer.tsx`

- Remove the `/affiliate` route from `App.tsx`
- Remove the "Affiliate" link from `navLinks` in `Navbar.tsx`
- Remove the Affiliate import
- The `src/pages/Affiliate.tsx` file can remain (unused) or be deleted

---

## 2. Add Explainable AI Service

**Files affected:** `src/pages/Index.tsx`, `src/pages/Services.tsx`

Add a new service card for "Explainable AI" in both the homepage services grid and the Services page:
- Title: "Explainable AI"
- Description: Transparent, interpretable AI models that clinicians can trust -- every recommendation comes with clear reasoning, audit trails, and decision rationale to support clinical confidence and regulatory alignment.
- Tags: Interpretability, Decision Audit, Clinical Trust, Model Transparency

---

## 3. Redesign Hero Headline & UX Enhancements

**Files affected:** `src/pages/Index.tsx`

Inspired by Heidi Health ("Get time back. Move care forward.") and Lyrebird Health's centered, bold typographic hero with italic accent words:

- **Rephrase the headline** from "Tailored AI for Every Hospital & Clinic's Needs" to something more evocative and elegant, such as:
  > "Intelligent AI, *personalised* for your practice."
  
  With a supporting subline that captures the tailored nature:
  > "Every hospital is different. Our AI adapts to your workflows, regulations, and patient needs -- so you can focus on what matters most: care."

- **Center-align the hero** for a cleaner, more modern look (like Heidi/Lyrebird), moving the dashboard visual below or to the side
- Add subtle sparkle/cross decorative elements similar to Heidi's design aesthetic
- Improve spacing and breathing room throughout sections

---

## 4. Blog Section -- Real Clickable Articles

**Files affected:** `src/pages/Blog.tsx`

Replace the current static/fake blog posts with real, recent healthcare AI articles. Each card will be an external link (`<a href="..." target="_blank">`) that navigates to the full article on its official source.

Real articles to include:

| Title | Source | URL |
|-------|--------|-----|
| 2026 Healthcare Trends: Strategic Imperatives for Effective AI | CapTech | captechconsulting.com |
| How AI Agents and Tech Will Transform Health Care in 2026 | BCG | bcg.com |
| The Landscape of AI Implementation in US Hospitals | Nature Health | nature.com |
| AI Is Entering Health Care, and Nurses Are Being Asked to Trust It | Scientific American | scientificamerican.com |
| Six Healthcare Trends to Watch in 2026 | Global Healthcare Resource | globalhealthcareresource.com |
| Top Health Care Trends for 2026 | Cigna Newsroom | newsroom.cigna.com |

Each card will show: source name, title, a brief description, and "Read Article" with an external link arrow icon. Clicking anywhere on the card opens the article in a new tab.

---

## 5. Services Page -- Add Explainable AI

**Files affected:** `src/pages/Services.tsx`

Add the Explainable AI card to the services grid on the dedicated Services page, matching the existing card pattern.

---

## Technical Details

### Files to modify:
1. **`src/components/Navbar.tsx`** -- Remove "Affiliate" from `navLinks` array
2. **`src/App.tsx`** -- Remove Affiliate route and import
3. **`src/pages/Index.tsx`** -- Restyle hero (centered layout, new headline), add Explainable AI to services array
4. **`src/pages/Blog.tsx`** -- Replace static posts with real article data, wrap cards in `<a>` tags with `target="_blank"`
5. **`src/pages/Services.tsx`** -- Add Explainable AI service card

### No new dependencies required.
All changes use existing packages (framer-motion, lucide-react, react-router-dom).

