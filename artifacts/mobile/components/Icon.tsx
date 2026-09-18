/**
 * Icon — 100% inline SVG icons, zero font dependency.
 * Replaces @expo/vector-icons (Feather + Ionicons) across the app.
 * All icons are 24×24 viewBox, stroke-based, rounded caps/joins.
 */
import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

export type IconName =
  | 'alert-circle'
  | 'arrow-up'
  | 'bulb-outline'
  | 'camera'
  | 'check'
  | 'copy'
  | 'create-outline'
  | 'download'
  | 'edit'
  | 'edit-3'
  | 'file-text'
  | 'flask-outline'
  | 'image'
  | 'menu'
  | 'mic-outline'
  | 'moon-outline'
  | 'plus'
  | 'search-outline'
  | 'square'
  | 'stop-circle'
  | 'sunny-outline'
  | 'thumbs-down'
  | 'thumbs-up'
  | 'trash-2'
  | 'x';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = '#000', strokeWidth = 2 }: IconProps) {
  const s = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  const paths: Record<IconName, React.ReactNode> = {
    'menu': (
      <>
        <Line x1="3" y1="6"  x2="21" y2="6"  {...s} />
        <Line x1="3" y1="12" x2="21" y2="12" {...s} />
        <Line x1="3" y1="18" x2="21" y2="18" {...s} />
      </>
    ),
    'x': (
      <>
        <Line x1="18" y1="6"  x2="6"  y2="18" {...s} />
        <Line x1="6"  y1="6"  x2="18" y2="18" {...s} />
      </>
    ),
    'plus': (
      <>
        <Line x1="12" y1="5"  x2="12" y2="19" {...s} />
        <Line x1="5"  y1="12" x2="19" y2="12" {...s} />
      </>
    ),
    'edit': (
      <>
        <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" {...s} />
        <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" {...s} />
      </>
    ),
    'download': (
      <>
        <Path d="M12 3v12" {...s} />
        <Polyline points="7 10 12 15 17 10" {...s} />
        <Path d="M5 21h14" {...s} />
      </>
    ),
    'edit-3': (
      <>
        <Path d="M12 20h9" {...s} />
        <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" {...s} />
      </>
    ),
    'trash-2': (
      <>
        <Polyline points="3 6 5 6 21 6" {...s} />
        <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...s} />
        <Line x1="10" y1="11" x2="10" y2="17" {...s} />
        <Line x1="14" y1="11" x2="14" y2="17" {...s} />
      </>
    ),
    'file-text': (
      <>
        <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...s} />
        <Polyline points="14 2 14 8 20 8" {...s} />
        <Line x1="16" y1="13" x2="8" y2="13" {...s} />
        <Line x1="16" y1="17" x2="8" y2="17" {...s} />
        <Line x1="10" y1="9"  x2="8" y2="9"  {...s} />
      </>
    ),
    'image': (
      <>
        <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" {...s} />
        <Circle cx="8.5" cy="8.5" r="1.5" {...s} />
        <Polyline points="21 15 16 10 5 21" {...s} />
      </>
    ),
    'camera': (
      <>
        <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" {...s} />
        <Circle cx="12" cy="13" r="4" {...s} />
      </>
    ),
    'square': (
      <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke={color} strokeWidth={strokeWidth} fill={color} />
    ),
    'arrow-up': (
      <>
        <Line x1="12" y1="19" x2="12" y2="5" {...s} />
        <Polyline points="5 12 12 5 19 12" {...s} />
      </>
    ),
    'copy': (
      <>
        <Rect x="9" y="9" width="13" height="13" rx="2" ry="2" {...s} />
        <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...s} />
      </>
    ),
    'check': (
      <Polyline points="20 6 9 17 4 12" {...s} />
    ),
    'thumbs-up': (
      <Path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" {...s} />
    ),
    'thumbs-down': (
      <Path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" {...s} />
    ),
    'alert-circle': (
      <>
        <Circle cx="12" cy="12" r="10" {...s} />
        <Line x1="12" y1="8"  x2="12" y2="12" {...s} />
        <Line x1="12" y1="16" x2="12.01" y2="16" {...s} />
      </>
    ),
    'moon-outline': (
      <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" {...s} />
    ),
    'sunny-outline': (
      <>
        <Circle cx="12" cy="12" r="5" {...s} />
        <Line x1="12" y1="1"     x2="12" y2="3"     {...s} />
        <Line x1="12" y1="21"    x2="12" y2="23"    {...s} />
        <Line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"  {...s} />
        <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" {...s} />
        <Line x1="1"  y1="12" x2="3"  y2="12" {...s} />
        <Line x1="21" y1="12" x2="23" y2="12" {...s} />
        <Line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" {...s} />
        <Line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  {...s} />
      </>
    ),
    'mic-outline': (
      <>
        <Rect x="9" y="2" width="6" height="11" rx="3" {...s} />
        <Path d="M19 10v2a7 7 0 0 1-14 0v-2" {...s} />
        <Line x1="12" y1="19" x2="12" y2="23" {...s} />
        <Line x1="8"  y1="23" x2="16" y2="23" {...s} />
      </>
    ),
    'stop-circle': (
      <>
        <Circle cx="12" cy="12" r="10" {...s} />
        <Rect x="9" y="9" width="6" height="6" stroke={color} strokeWidth={strokeWidth} fill={color} />
      </>
    ),
    'bulb-outline': (
      <>
        <Path d="M9 18h6M9 21h6" {...s} />
        <Path d="M12 2a7 7 0 0 1 5 11.9V17a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-3.1A7 7 0 0 1 12 2z" {...s} />
      </>
    ),
    'create-outline': (
      <>
        <Path d="M12 20h9" {...s} />
        <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" {...s} />
      </>
    ),
    'flask-outline': (
      <>
        <Path d="M9 2v7.5L4.5 17A2 2 0 0 0 6.4 20h11.2a2 2 0 0 0 1.9-3L15 9.5V2" {...s} />
        <Line x1="9" y1="2" x2="15" y2="2" {...s} />
        <Line x1="5.5" y1="14.5" x2="18.5" y2="14.5" {...s} />
      </>
    ),
    'search-outline': (
      <>
        <Circle cx="11" cy="11" r="8" {...s} />
        <Line x1="21" y1="21" x2="16.65" y2="16.65" {...s} />
      </>
    ),
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {paths[name]}
    </Svg>
  );
}
