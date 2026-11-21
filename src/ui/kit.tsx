/** Shared building blocks. Colours come from the active profile's theme. */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { palettes, radius, type Palette } from '../core/theme';
import { Icon, type IconName } from './Icon';
import { useNav } from './nav';

export const ThemeCtx = createContext<Palette>(palettes.con);
export const useTheme = () => useContext(ThemeCtx);

export const font = Platform.select({ ios: 'System', default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif' });

export function Txt({ children, size = 15, weight = '400', color, style, mono, center, numberOfLines }: {
  children: ReactNode; size?: number; weight?: '400' | '500' | '600' | '700'; color?: string; style?: object; mono?: boolean; center?: boolean; numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: color ?? t.text, fontSize: size, fontWeight: weight, lineHeight: Math.round(size * 1.35), fontFamily: font, fontVariant: mono ? ['tabular-nums'] : undefined, textAlign: center ? 'center' : undefined }, style]}
    >
      {children}
    </Text>
  );
}

export const Label = ({ children, color }: { children: ReactNode; color?: string }) => {
  const t = useTheme();
  return <Txt size={12} weight="600" color={color ?? t.muted} style={{ textTransform: 'uppercase', letterSpacing: 0.7 }}>{children}</Txt>;
};

export function Screen({ title, kicker, children, right, back, scroll = true, pad = true }: {
  title?: string; kicker?: string; children: ReactNode; right?: ReactNode; back?: boolean; scroll?: boolean; pad?: boolean;
}) {
  const t = useTheme();
  const nav = useNav();
  const showBack = back ?? nav.depth > 1;
  const header = (
    <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 6, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
        {showBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={nav.back} style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" color={t.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          {kicker ? <Label>{kicker}</Label> : null}
          {title ? <Txt size={showBack ? 22 : 30} weight="700">{title}</Txt> : null}
        </View>
        {right}
      </View>
    </View>
  );
  const body = <View style={{ paddingHorizontal: pad ? 20 : 0, paddingBottom: 120, gap: 14 }}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          {header}
          {body}
        </ScrollView>
      ) : (
        <>
          {header}
          {body}
        </>
      )}
    </View>
  );
}

export function Card({ children, style, onPress, accent }: { children: ReactNode; style?: ViewStyle; onPress?: () => void; accent?: boolean }) {
  const t = useTheme();
  const s: ViewStyle = { backgroundColor: t.card, borderRadius: radius.l, padding: 16, gap: 10, borderWidth: accent ? 1 : 0, borderColor: t.accent, ...style };
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.75 }]}>
      {children}
    </Pressable>
  ) : (
    <View style={s}>{children}</View>
  );
}

export function Row({ children, gap = 10, style, wrap }: { children: ReactNode; gap?: number; style?: ViewStyle; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Button({ title, onPress, kind = 'primary', icon, disabled, small, flex, color }: {
  title: string; onPress?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName; disabled?: boolean; small?: boolean; flex?: boolean; color?: string;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? (color ?? t.accent) : kind === 'danger' ? t.bad : kind === 'secondary' ? t.raised : 'transparent';
  const fg = kind === 'primary' ? t.onAccent : kind === 'danger' ? '#1B0000' : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{
        minHeight: small ? 40 : 50, paddingHorizontal: small ? 14 : 20, borderRadius: 26, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: kind === 'secondary' ? 1 : 0, borderColor: t.line, opacity: disabled ? 0.45 : pressed ? 0.75 : 1, flex: flex ? 1 : undefined,
      }]}
    >
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Txt size={small ? 14 : 16} weight="600" color={fg}>{title}</Txt>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, color }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.card, opacity: pressed ? 0.7 : 1 })}>
      <Icon name={icon} color={color ?? t.text} />
    </Pressable>
  );
}

export function Field({ label, suffix, style, ...rest }: TextInputProps & { label?: string; suffix?: string; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Txt size={13} color={t.soft}>{label}</Txt> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.raised, borderRadius: radius.m, borderWidth: 1, borderColor: t.line, paddingHorizontal: 12 }}>
        <TextInput
          accessibilityLabel={label ?? rest.placeholder}
          placeholderTextColor={t.muted}
          style={{ flex: 1, minHeight: 46, color: t.text, fontSize: 16, fontFamily: font }}
          {...rest}
        />
        {suffix ? <Txt color={t.muted}>{suffix}</Txt> : null}
      </View>
    </View>
  );
}

/** Compact number box for set logging. */
export function NumBox({ value, onChange, label, width = 64, highlight }: { value: string; onChange: (s: string) => void; label: string; width?: number; highlight?: boolean }) {
  const t = useTheme();
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      keyboardType="decimal-pad"
      inputMode="decimal"
      selectTextOnFocus
      placeholder="–"
      placeholderTextColor={t.muted}
      style={{ width, height: 40, textAlign: 'right', paddingHorizontal: 8, borderRadius: 10, backgroundColor: t.raised, borderWidth: 1, borderColor: highlight ? t.accent : t.line, color: t.text, fontSize: 16, fontFamily: font }}
    />
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.card, borderRadius: 22, padding: 4, gap: 4 }}>
      {options.map((o) => (
        <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: o.value === value }} onPress={() => onChange(o.value)}
          style={{ flex: 1, minHeight: 38, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: o.value === value ? t.raised : 'transparent', paddingHorizontal: 6 }}>
          <Txt size={13} weight={o.value === value ? '600' : '400'} color={o.value === value ? t.text : t.muted}>{o.label}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

export function Chip({ label, on, onPress, color }: { label: string; on?: boolean; onPress?: () => void; color?: string }) {
  const t = useTheme();
  const c = color ?? t.accent;
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityState={{ selected: on }} onPress={onPress}
      style={{ minHeight: 34, paddingHorizontal: 12, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? c : t.raised, borderWidth: 1, borderColor: on ? c : t.line }}>
      <Txt size={13} weight={on ? '600' : '400'} color={on ? t.onAccent : t.soft}>{label}</Txt>
    </Pressable>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.card, borderRadius: radius.m, padding: 14, gap: 4, minWidth: 140 }}>
      <Label>{label}</Label>
      <Txt size={24} weight="700" mono color={color}>{value}</Txt>
      {sub ? <Txt size={12} color={t.muted}>{sub}</Txt> : null}
    </View>
  );
}

export function ListItem({ title, sub, right, onPress, icon, iconColor }: { title: string; sub?: string; right?: ReactNode; onPress?: () => void; icon?: IconName; iconColor?: string }) {
  const t = useTheme();
  const inner = (
    <>
      {icon ? (
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.raised, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} color={iconColor ?? t.accent} size={20} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt weight="600">{title}</Txt>
        {sub ? <Txt size={13} color={t.muted}>{sub}</Txt> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron" size={18} color={t.muted} /> : null)}
    </>
  );
  const style: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.card, borderRadius: radius.m, padding: 14, minHeight: 60 };
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.75 }]}>{inner}</Pressable> : <View style={style}>{inner}</View>;
}

export function Toggle({ label, value, onChange, sub }: { label: string; value: boolean; onChange: (v: boolean) => void; sub?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <Txt>{label}</Txt>
        {sub ? <Txt size={13} color={t.muted}>{sub}</Txt> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: t.accent, false: t.line }} thumbColor="#fff" />
    </View>
  );
}

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.card, borderRadius: radius.l, padding: 22, gap: 8, alignItems: 'center' }}>
      <Txt weight="600" center>{title}</Txt>
      {sub ? <Txt size={14} color={t.muted} center>{sub}</Txt> : null}
      {action}
    </View>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'good' }) {
  const t = useTheme();
  const c = tone === 'warn' ? t.warn : tone === 'good' ? t.good : t.soft;
  return (
    <View style={{ borderWidth: 1, borderColor: c, borderRadius: radius.m, padding: 12 }}>
      <Txt size={13} color={c}>{children}</Txt>
    </View>
  );
}

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 14, maxHeight: '88%', borderTopWidth: 1, borderColor: t.line }}>
        <Row>
          <Txt size={19} weight="700" style={{ flex: 1 }}>{title}</Txt>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </Row>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 10 }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

export function ProgressBar({ pct, color, height = 8 }: { pct: number; color?: string; height?: number }) {
  const t = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }} style={{ height, borderRadius: height / 2, backgroundColor: t.raised, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height, backgroundColor: color ?? t.accent, borderRadius: height / 2 }} />
    </View>
  );
}

export const styles = StyleSheet.create({ grow: { flex: 1 } });

/** Current time, refreshed every `intervalMs` (keeps clock reads out of render). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}
