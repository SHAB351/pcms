/**
 * Tailwind CSS 4 via PostCSS.
 *
 * Le loader Turbopack `@tailwindcss/turbopack` déclaré dans `next.config.ts`
 * ne s'exécutait pas : `@import "tailwindcss"` était résolu comme un simple
 * import CSS, ce qui émettait les couches `theme` et `base` mais aucune classe
 * utilitaire. Passer par PostCSS est l'intégration officielle Next 16 + Tailwind 4
 * et fonctionne avec Turbopack comme avec n'importe quel bundler.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
