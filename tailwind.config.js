/**
 * DESIGN DECISION: Tailwind CSS Configuration
 * 
 * Tailwind enables utility-first styling without custom CSS files.
 * 
 * Key Choices:
 * 
 * 1. **Content Paths**:
 *    Scans all .tsx/.ts/.jsx/.js files in root, components/, and services/
 *    Tailwind purges unused classes in production based on these paths.
 *    Result: ~5KB CSS vs. 3MB full Tailwind (massive performance win)
 * 
 * 2. **Typography Plugin**:
 *    '@tailwindcss/typography' adds prose classes for rich text rendering.
 *    Used for: AI-generated markdown responses, tutorial content, legal pages
 *    Provides semantic styles (headings, lists, code blocks) out of the box.
 * 
 * 3. **Default Theme Extension**:
 *    theme.extend = {} means we keep all default Tailwind utilities
 *    Custom colors/fonts can be added here without losing defaults
 *    Current approach: Use default slate/indigo palette for consistency
 * 
 * 4. **Flat File Structure**:
 *    Files in root (./*.tsx) scanned directly
 *    Matches the project's flat src-less structure
 *    Enables Tailwind detection for App.tsx, index.tsx, types.ts, etc.
 * 
 * Why Tailwind vs CSS-in-JS?
 * - No runtime cost (styles are static)
 * - Atomic CSS = aggressive reuse (small bundle)
 * - Design system consistency via utility naming
 * - Responsive design with sm:/md:/lg: prefixes
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
