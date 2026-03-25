import * as esbuild from 'esbuild';
import { mkdirSync, existsSync } from 'fs';

// Ensure dist directory exists
if (!existsSync('dist')) {
  mkdirSync('dist');
}

// Plugin to replace node-fetch with native fetch (Node 20+)
const nativeFetchPlugin = {
  name: 'native-fetch',
  setup(build) {
    // Intercept node-fetch imports and return native fetch
    build.onResolve({ filter: /^node-fetch$/ }, () => ({
      path: 'node-fetch',
      namespace: 'native-fetch',
    }));
    build.onLoad({ filter: /.*/, namespace: 'native-fetch' }, () => ({
      contents: `
        module.exports = fetch;
        module.exports.default = fetch;
        module.exports.Request = Request;
        module.exports.Response = Response;
        module.exports.Headers = Headers;
      `,
      loader: 'js',
    }));

    // Same for abort-controller
    build.onResolve({ filter: /^abort-controller$/ }, () => ({
      path: 'abort-controller',
      namespace: 'native-abort',
    }));
    build.onLoad({ filter: /.*/, namespace: 'native-abort' }, () => ({
      contents: `
        module.exports = AbortController;
        module.exports.default = AbortController;
        module.exports.AbortController = AbortController;
        module.exports.AbortSignal = AbortSignal;
      `,
      loader: 'js',
    }));
  },
};

await esbuild.build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/handler.js',
  format: 'cjs',
  minify: false,
  sourcemap: true,
  external: [],
  plugins: [nativeFetchPlugin],
});

console.log('Build complete: dist/handler.js');
