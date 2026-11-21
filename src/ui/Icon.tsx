import Svg, { Circle, Path, Rect } from 'react-native-svg';

const P: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9H3z',
  dumbbell: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
  chart: 'M4 19l5-6 4 3 7-9',
  users: 'M2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 8 1 8 5',
  calendar: 'M3 10h18M8 3v4M16 3v4',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5 9-10',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4a3 3 0 003 3M17 6h3a3 3 0 01-3 3',
  run: 'M8 21l3-6 3 2v5M7 11l4-3 4 3 3 1',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z',
  lock: 'M8 11V8a4 4 0 018 0v3',
  eyeOff: 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c5 0 9 6 9 6a16 16 0 01-3 3.6M6.6 6.6C4.4 8 3 12 3 12s4 6 9 6a9 9 0 004.4-1.1',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  timer: 'M12 8v5l3 2M9 2h6M12 22a8 8 0 100-16 8 8 0 000 16z',
  flame: 'M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-4 3 0-2-1-4-3-6 0 4-3 6-3 11 0 4 3 8 7 8z',
  share: 'M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M12 3v12M7 8l5-5 5 5',
  upload: 'M12 15V3M7 8l5-5 5 5M4 17v3h16v-3',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  sync: 'M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5',
  scale: 'M4 20h16V8a4 4 0 00-4-4H8a4 4 0 00-4 4zM12 8l2 3',
  route: 'M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM6 15V9a4 4 0 014-4h2M18 9v6a4 4 0 01-4 4h-2',
  chevron: 'M9 5l7 7-7 7',
  bell: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0',
};

export function Icon({ name, size = 22, color = 'currentColor', stroke = 2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {name === 'users' ? (
        <>
          <Circle cx={8} cy={8} r={3} />
          <Circle cx={16} cy={8} r={3} />
        </>
      ) : null}
      {name === 'calendar' ? <Rect x={3} y={5} width={18} height={16} rx={2} /> : null}
      {name === 'lock' ? <Rect x={5} y={11} width={14} height={10} rx={2} /> : null}
      {name === 'run' ? <Circle cx={14} cy={4} r={2} /> : null}
      {name === 'camera' ? <Circle cx={12} cy={13} r={3.5} /> : null}
      <Path d={P[name] ?? ''} />
    </Svg>
  );
}

export type IconName = keyof typeof P;
