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
        { name: 'light', value: '#f8fafc' }, // slate-50
        { name: 'dark', value: '#020617' }, // slate-950
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
