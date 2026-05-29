import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview } from '@storybook/react';

// Tailwind v4 + custom variants. The app's `<html>` gets a `dark` class
// (see apps/admin-frontend/index.html bootstrap script). We mirror that
// here via the themes addon so every story respects the dark variant.
import '../src/styles.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: 'oklch(0.974 0.005 80)' }, // --app-bg (warm paper)
        { name: 'dark', value: 'oklch(0.175 0.006 80)' }, // --app-bg (warm charcoal)
      ],
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
      parentSelector: 'html',
    }),
  ],
};

export default preview;
