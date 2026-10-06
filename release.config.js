// Releases are a GitHub release with the bundle attached. The package is never
// published to npm and nothing is committed back to main, so no token that can
// bypass branch protection is needed. Continues from the existing `0.0.1` tag.
export default {
  branches: ['main'],
  tagFormat: '${version}',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'angular',
        releaseRules: [
          { type: 'refactor', release: 'patch' },
          { type: 'perf', release: 'patch' },
        ],
      },
    ],
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/github',
      {
        // `latest` is what customers' embed snippets load; a person publishes the draft.
        draftRelease: true,
        assets: [
          'dist/webRTCWidget.js',
          'dist/webRTCWidget.js.br',
          'dist/webRTCWidget.js.gz',
        ],
      },
    ],
  ],
};
