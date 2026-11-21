/** Front and back silhouette coloured by muscle recovery (extra G). Abstract shapes only. */
import Svg, { Circle, Ellipse, G, Rect, Text as SvgText } from 'react-native-svg';
import type { MuscleGroup, Sex } from '../core/types';
import { useTheme } from './kit';

export function BodyMap({ status, sex }: { status: Record<MuscleGroup, { hoursLeft: number }>; sex: Sex }) {
  const t = useTheme();
  const c = (g: MuscleGroup) => (status[g].hoursLeft > 24 ? t.warn : status[g].hoursLeft > 0 ? '#E8C26A' : t.good);
  const base = t.raised;
  const hip = sex === 'female' ? 30 : 26;
  const sh = sex === 'female' ? 30 : 36;
  const figure = (x: number, back: boolean) => (
    <G>
      <Circle cx={x} cy={22} r={13} fill={base} />
      {/* shoulders */}
      <Ellipse cx={x - sh + 6} cy={52} rx={11} ry={9} fill={c('shoulders')} />
      <Ellipse cx={x + sh - 6} cy={52} rx={11} ry={9} fill={c('shoulders')} />
      {/* torso: chest/back, core */}
      <Rect x={x - 24} y={46} width={48} height={34} rx={12} fill={back ? c('back') : c('chest')} />
      <Rect x={x - 21} y={82} width={42} height={30} rx={10} fill={back ? c('back') : c('core')} />
      {/* hips / glutes */}
      <Rect x={x - hip} y={112} width={hip * 2} height={24} rx={11} fill={back ? c('glutes') : base} />
      {/* arms */}
      <Rect x={x - sh - 10} y={60} width={14} height={56} rx={7} fill={c('arms')} />
      <Rect x={x + sh - 4} y={60} width={14} height={56} rx={7} fill={c('arms')} />
      {/* legs */}
      <Rect x={x - 22} y={138} width={18} height={78} rx={9} fill={c('legs')} />
      <Rect x={x + 4} y={138} width={18} height={78} rx={9} fill={c('legs')} />
      <SvgText fontFamily="-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif" x={x} y={236} fill={t.muted} fontSize={11} textAnchor="middle">{back ? 'Back' : 'Front'}</SvgText>
    </G>
  );
  const ready = (Object.keys(status) as MuscleGroup[]).filter((g) => status[g].hoursLeft <= 0);
  return (
    <Svg width="100%" height={244} viewBox="0 0 320 244" accessibilityRole="image" accessibilityLabel={`Ready: ${ready.join(', ') || 'none'}. Recovering: ${(Object.keys(status) as MuscleGroup[]).filter((g) => status[g].hoursLeft > 0).join(', ') || 'none'}.`}>
      {figure(90, false)}
      {figure(230, true)}
    </Svg>
  );
}
