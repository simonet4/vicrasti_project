import { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';

// Charte : fond légèrement chaud, texte quasi noir, un seul accent (indigo).
// Les couleurs d'état ne servent qu'à signaler (retard, réussite).
const light = {
  bg: '#F6F6F3',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEFEB',
  text: '#18181B',
  textMuted: '#6B6B73',
  textFaint: '#A3A3AA',
  border: '#E6E6E1',
  accent: '#4F46E5',
  accentSoft: '#ECEBFD',
  onAccent: '#FFFFFF',
  success: '#15955A',
  successSoft: '#E5F4EC',
  warning: '#C97A12',
  warningSoft: '#FBF1E1',
  danger: '#D33B3B',
  dangerSoft: '#FBEAEA',
  overlay: 'rgba(16,16,20,0.42)',
};

const dark = {
  bg: '#0C0C0E',
  surface: '#17171A',
  surfaceAlt: '#212125',
  text: '#F4F4F5',
  textMuted: '#A1A1AA',
  textFaint: '#66666E',
  border: '#27272B',
  accent: '#8B87F7',
  accentSoft: '#23223A',
  onAccent: '#FFFFFF',
  success: '#3CC683',
  successSoft: '#142A1E',
  warning: '#EBA24A',
  warningSoft: '#2E2414',
  danger: '#F06767',
  dangerSoft: '#321A1A',
  overlay: 'rgba(0,0,0,0.6)',
};

export const getTheme = (isDark) => ({ ...(isDark ? dark : light), isDark: !!isDark });

export const ThemeContext = createContext(getTheme(false));
export const useTheme = () => useContext(ThemeContext);

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const type = StyleSheet.create({
  display: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontSize: 21, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  caption: { fontSize: 13, lineHeight: 18 },
  small: { fontSize: 11, lineHeight: 15 },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
});
