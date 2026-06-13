import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)'],
  // Storybook 10: addon-essentials was deprecated. The previously-bundled
  // controls/actions/viewport/backgrounds/toolbars/measure/outline/highlight
  // are now part of the core `storybook` package. Only docs needs to be
  // listed explicitly, alongside our themes addon.
  addons: ['@storybook/addon-docs', '@storybook/addon-themes'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    // Use the project's existing tsconfig + react-docgen-typescript for prop tables.
    reactDocgen: 'react-docgen-typescript',
  },
  core: {
    disableTelemetry: true,
  },
}

export default config
