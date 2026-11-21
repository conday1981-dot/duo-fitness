import Svg, { Circle, Path, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from './kit';

export function Ring({ pct, size = 84, label }: { pct: number; size?: number; label?: string }) {
  const t = useTheme();
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <Svg width={size} height={size} accessibilityRole="image" accessibilityLabel={`${Math.round(p)} percent`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.raised} strokeWidth={9} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.accent} strokeWidth={9} fill="none" strokeLinecap="round"
        strokeDasharray={`${(p / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <SvgText fontFamily="-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif" x={size / 2} y={size / 2 + 6} fill={t.text} fontSize={17} fontWeight="700" textAnchor="middle">{label ?? `${Math.round(p)}%`}</SvgText>
    </Svg>
  );
}

/** Raw readings (faint) plus the 7-day average (accent). */
export function TrendChart({ raw, avg, width = 320, height = 110, target }: { raw: number[]; avg: number[]; width?: number; height?: number; target?: number }) {
  const t = useTheme();
  const all = [...raw, ...avg, ...(target != null ? [target] : [])];
  if (raw.length < 2) return null;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const y = (v: number) => 8 + (1 - (v - min) / span) * (height - 16);
  const x = (i: number, n: number) => (i / Math.max(1, n - 1)) * width;
  const path = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i, vs.length).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" accessibilityRole="image" accessibilityLabel={`Trend from ${raw[0]} to ${raw[raw.length - 1]}`}>
      {target != null ? <Line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke={t.line} strokeDasharray="4 6" /> : null}
      <Path d={path(raw)} stroke={t.line} strokeWidth={2} fill="none" />
      <Path d={path(avg)} stroke={t.accent} strokeWidth={3} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function Bars({ values, labels, height = 70, color }: { values: number[]; labels: string[]; height?: number; color?: string }) {
  const t = useTheme();
  const max = Math.max(1, ...values);
  const w = 320;
  const bw = w / values.length;
  return (
    <Svg width="100%" height={height + 18} viewBox={`0 0 ${w} ${height + 18}`} accessibilityRole="image" accessibilityLabel={values.map((v, i) => `${labels[i]} ${v}`).join(', ')}>
      {values.map((v, i) => {
        const h = Math.max(v ? 4 : 0, (v / max) * height);
        return <Path key={i} d={`M${i * bw + 6} ${height} V${height - h} h${bw - 12} V${height} Z`} fill={color ?? t.accent} opacity={v ? 0.9 : 0.25} />;
      })}
      {labels.map((l, i) => <SvgText fontFamily="-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif" key={l + i} x={i * bw + bw / 2} y={height + 14} fill={t.muted} fontSize={11} textAnchor="middle">{l}</SvgText>)}
    </Svg>
  );
}
