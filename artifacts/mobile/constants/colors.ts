// Gemini-inspired design tokens
const lightPalette = {
  // Core backgrounds
  background: '#f8f9fd',
  foreground: '#1a1c2e',

  // Surfaces
  surface: '#ffffff',
  surfaceHover: '#eef2fb',
  surfaceLight: '#e3e9f7',
  sidebar: '#eef2fb',

  // Brand — Google blue & purple
  primary: '#4285f4',
  primaryForeground: '#ffffff',
  brand: '#1a73e8',
  brandPurple: '#7c3aed',
  brandLight: '#8ab4f8',

  // Gradient colors
  gradientStart: '#1a73e8',
  gradientEnd: '#9333ea',

  // Text
  text: '#1f2937',
  textMuted: '#5f6368',
  textSubtle: '#9aa0a6',

  // Cards / elevated surfaces
  card: '#ffffff',
  cardForeground: '#1f2937',

  // User bubble
  userBubble: '#e8f0fe',
  userBubbleText: '#1a1c2e',

  // Secondary
  secondary: '#f1f3f4',
  secondaryForeground: '#3c4043',

  // Muted
  muted: '#f1f3f4',
  mutedForeground: '#5f6368',

  // Accent
  accent: '#e8f0fe',
  accentForeground: '#185abc',

  // Destructive
  destructive: '#ea4335',
  destructiveForeground: '#ffffff',

  // Borders & inputs
  border: '#dadce0',
  input: '#f8f9fd',
  codeBackground: '#111827',
  codeHeader: '#1f2937',
  codeText: '#f3f4f6',

  // Legacy aliases
  tint: '#1a73e8',
};

const darkPalette = {
  // Core backgrounds
  background: '#0f111a',
  foreground: '#f8f9fd',

  // Surfaces
  surface: '#1a1d29',
  surfaceHover: '#252a3a',
  surfaceLight: '#2e3448',
  sidebar: '#161922',

  // Brand — Google blue & purple
  primary: '#8ab4f8',
  primaryForeground: '#0f111a',
  brand: '#8ab4f8',
  brandPurple: '#c58af9',
  brandLight: '#aecbfa',

  // Gradient colors
  gradientStart: '#4285f4',
  gradientEnd: '#a855f7',

  // Text
  text: '#e8eaed',
  textMuted: '#9aa0a6',
  textSubtle: '#5f6368',

  // Cards / elevated surfaces
  card: '#1a1d29',
  cardForeground: '#e8eaed',

  // User bubble
  userBubble: '#1e3a5f',
  userBubbleText: '#e8eaed',

  // Secondary
  secondary: '#1e1f2e',
  secondaryForeground: '#e8eaed',

  // Muted
  muted: '#282a36',
  mutedForeground: '#9aa0a6',

  // Accent
  accent: '#1e293b',
  accentForeground: '#93c5fd',

  // Destructive
  destructive: '#f87171',
  destructiveForeground: '#0f111a',

  // Borders & inputs
  border: '#2c2e40',
  input: '#1a1d29',
  codeBackground: '#0b1020',
  codeHeader: '#182033',
  codeText: '#f3f4f6',

  // Legacy aliases
  tint: '#8ab4f8',
};

const colors = {
  light: lightPalette,
  dark: darkPalette,
  radius: 12,
};

export default colors;
