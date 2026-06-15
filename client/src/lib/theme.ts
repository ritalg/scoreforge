export type Theme = 'light' | 'dark' | 'system';

export function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem('theme', theme);
}

export function applyFontSize(size: 'sm' | 'md' | 'lg' | 'xl') {
  document.documentElement.classList.remove('font-sm', 'font-md', 'font-lg', 'font-xl');
  document.documentElement.classList.add(`font-${size}`);
}
