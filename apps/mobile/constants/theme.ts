/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

export const Colors = {
  light: {
    text: '#191C1D',
    background: '#F8FAFA',
    tint: '#00696E',
    primary: '#00696E',
    secondary: '#3C494A',
    muted: '#687778',
    card: '#FFFFFF',
    border: '#D7E4E5',
    soft: '#EAF3F3',
    accent: '#00AEB5',
    error: '#BA1A1A',
    icon: '#687778',
    tabIconDefault: '#687778',
    tabIconSelected: '#00696E',
  },
  dark: {
    text: '#E9F1F1',
    background: '#101414',
    tint: '#7BDDE0',
    primary: '#7BDDE0',
    secondary: '#B9C9C9',
    muted: '#8D9B9B',
    card: '#182020',
    border: '#334343',
    soft: '#203333',
    accent: '#7BDDE0',
    error: '#FFB4AB',
    icon: '#B9C9C9',
    tabIconDefault: '#8D9B9B',
    tabIconSelected: '#7BDDE0',
  },
};

export type AppColors = typeof Colors.light;
