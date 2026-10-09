import esbuild from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import { copyFileSync, mkdirSync, readFileSync } from 'fs';
import sveltePreprocess from 'svelte-preprocess';

const pack = JSON.parse(readFileSync('./package.json', 'utf8'));
const isProduction = process.env.NODE_ENV === 'production';

// bundle
await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  minify: isProduction,
  sourcemap: isProduction ? 'linked' : 'inline',
  legalComments: 'none',
  logLevel: 'info',
  mainFields: ['svelte', 'browser', 'module', 'main'],
  conditions: ['svelte'],
  external: ['electron', 'obsidian'],
  loader: { '.njk': 'text', '.svg': 'text', '.html': 'text' },
  define: {
    PACKAGE_NAME: JSON.stringify(pack.name),
    VERSION: JSON.stringify(pack.version),
    PRODUCTION: JSON.stringify(isProduction),
  },
  plugins: [
    sveltePlugin({
      preprocess: sveltePreprocess(),
      compilerOptions: { css: true },
    }),
  ],
});

// static plugin files
mkdirSync('dist', { recursive: true });
copyFileSync('manifest.json', 'dist/manifest.json');
copyFileSync('styles.css', 'dist/styles.css');
