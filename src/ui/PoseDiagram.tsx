/**
 * Jointed mannequin diagrams for the private catalogue (design doc §9).
 * Abstract figures only: head, torso and limbs as rounded segments, no
 * anatomical detail. {F} = in front / below, {B} = behind / above.
 */
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { PoseId } from '../domain/private';
import { useTheme } from './kit';

const SANS = '-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';

type Seg = [number, number, number, number, number]; // x1 y1 x2 y2 width
interface Figure { head: [number, number, number]; segs: Seg[]; over?: Seg[] }
interface Pose { view: 'above' | 'side'; front: Figure; back: Figure; labels: { front: [number, number, 'start' | 'end']; back: [number, number, 'start' | 'end'] }; arrow?: { x: number; y: number; dir: 'down' | 'left'; label: string } }

const POSES: Record<PoseId, Pose> = {
  spoon: {
    view: 'above',
    back: { head: [56, 94, 13], segs: [[80, 98, 146, 102, 26], [68, 96, 78, 97, 8], [158, 110, 192, 136, 15], [192, 136, 234, 128, 11], [234, 128, 246, 122, 8]], over: [[88, 104, 114, 124, 9], [114, 124, 142, 134, 8]] },
    front: { head: [62, 128, 13], segs: [[86, 132, 150, 136, 24], [74, 130, 84, 131, 8], [162, 144, 196, 170, 15], [196, 170, 238, 160, 11], [238, 160, 250, 154, 8], [92, 140, 108, 160, 9], [108, 160, 130, 158, 8]] },
    labels: { back: [258, 126, 'start'], front: [262, 160, 'start'] },
    arrow: { x: 150, y: 190, dir: 'down', label: 'Both facing this way' },
  },
  missionary: {
    view: 'side',
    front: { head: [56, 150, 13], segs: [[72, 152, 150, 152, 22], [155, 152, 195, 124, 14], [195, 124, 238, 152, 11], [80, 156, 110, 160, 8]] },
    back: { head: [66, 104, 13], segs: [[82, 110, 160, 124, 22], [166, 126, 206, 136, 14], [206, 136, 252, 140, 11]], over: [[90, 113, 94, 146, 8]] },
    labels: { back: [262, 136, 'start'], front: [250, 162, 'start'] },
    arrow: { x: 40, y: 204, dir: 'left', label: 'Heads this end' },
  },
  'on-top': {
    view: 'side',
    front: { head: [52, 154, 13], segs: [[68, 156, 160, 156, 22], [165, 156, 262, 160, 14]] },
    back: { head: [146, 50, 13], segs: [[152, 120, 146, 68, 22], [160, 122, 192, 156, 14], [192, 156, 150, 164, 11]], over: [[150, 80, 128, 110, 8], [128, 110, 112, 146, 7]] },
    labels: { back: [168, 46, 'start'], front: [268, 152, 'start'] },
    arrow: { x: 40, y: 204, dir: 'left', label: 'Heads this end' },
  },
  behind: {
    view: 'side',
    front: { head: [72, 104, 13], segs: [[92, 120, 176, 118, 22], [90, 124, 80, 166, 9], [178, 122, 182, 166, 14], [182, 166, 232, 167, 11]] },
    back: { head: [214, 50, 13], segs: [[206, 118, 212, 70, 22], [205, 122, 220, 166, 14], [220, 166, 266, 167, 11]], over: [[210, 82, 192, 104, 8], [192, 104, 180, 118, 7]] },
    labels: { back: [236, 46, 'start'], front: [52, 100, 'end'] },
    arrow: { x: 40, y: 204, dir: 'left', label: 'Both facing this way' },
  },
};

export function PoseDiagram({ pose, frontColor, backColor, frontLabel, backLabel }: { pose: PoseId; frontColor: string; backColor: string; frontLabel: 'Her' | 'Him'; backLabel: 'Her' | 'Him' }) {
  const t = useTheme();
  const p = POSES[pose];
  const fig = (f: Figure, color: string, segs: Seg[]) => (
    <G>
      {segs.map((s, i) => <Line key={i} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} stroke={color} strokeWidth={s[4]} strokeLinecap="round" />)}
    </G>
  );
  const head = (f: Figure, color: string) => <Circle cx={f.head[0]} cy={f.head[1]} r={f.head[2]} fill={color} />;
  const label = (at: [number, number, 'start' | 'end'], text: string, color: string) => <SvgText x={at[0]} y={at[1]} fill={color} fontSize={13} fontWeight="700" fontFamily={SANS} textAnchor={at[2]}>{text}</SvgText>;
  return (
    <Svg width="100%" height={220} viewBox="0 0 320 220" accessibilityRole="image" accessibilityLabel={`Diagram, ${p.view === 'above' ? 'from above' : 'from the side'}: ${frontLabel} in front or below, ${backLabel} behind or above.`}>
      {p.view === 'above' ? (
        <>
          <Rect x={8} y={64} width={304} height={122} rx={16} fill={t.raised} opacity={0.5} stroke={t.line} strokeWidth={2} />
          <Rect x={24} y={76} width={44} height={72} rx={14} fill={t.line} />
        </>
      ) : (
        <>
          <Rect x={8} y={168} width={304} height={18} rx={8} fill={t.raised} stroke={t.line} strokeWidth={2} />
          <Rect x={20} y={156} width={56} height={14} rx={7} fill={t.line} />
        </>
      )}
      {fig(p.back, backColor, p.back.segs)}
      {head(p.back, backColor)}
      {fig(p.front, frontColor, p.front.segs)}
      {head(p.front, frontColor)}
      {p.back.over ? fig(p.back, backColor, p.back.over) : null}
      {label(p.labels.back, backLabel, backColor)}
      {label(p.labels.front, frontLabel, frontColor)}
      {p.arrow ? (
        p.arrow.dir === 'down' ? (
          <G>
            <Path d={`M${p.arrow.x} ${p.arrow.y} v18 m-7 -7 l7 7 l7 -7`} stroke={t.soft} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <SvgText x={p.arrow.x + 14} y={p.arrow.y + 15} fill={t.soft} fontSize={12} fontFamily={SANS}>{p.arrow.label}</SvgText>
          </G>
        ) : (
          <G>
            <Path d={`M${p.arrow.x + 26} ${p.arrow.y} h-24 m7 -7 l-7 7 l7 7`} stroke={t.soft} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <SvgText x={p.arrow.x + 34} y={p.arrow.y + 4} fill={t.soft} fontSize={12} fontFamily={SANS}>{p.arrow.label}</SvgText>
          </G>
        )
      ) : null}
    </Svg>
  );
}
