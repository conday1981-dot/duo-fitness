/**
 * DUO – phase 0 check app.
 *
 * Not the real app. It answers the questions the design doc (section 12) left
 * open, on the real phone, after installing through A.M.Y Loader:
 *   1. Does an unsigned Codemagic IPA install and open?
 *   2. Is HealthKit granted with free signing, and which apps (Fitdays?)
 *      write body readings to Apple Health?
 *   3. Can we get "Always" location for runs with the screen locked?
 *   4. Does on-device text recognition (Apple Vision) build and work?
 * "Copy report" puts every result on the clipboard to paste back to Claude.
 *
 * In the browser preview (expo export --platform web), src/checks.web.ts
 * replaces the phone checks with simulated results.
 */
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { CHECKS, type CheckId, type Result } from './src/types';
import { RUNNERS, errText } from './src/checks';

const C = {
  bg: '#0E1116',
  card: '#161B22',
  text: '#E8EDF3',
  muted: '#8B97A6',
  accent: '#3DD6F5',
  pass: '#6FD99A',
  warn: '#F2A65A',
  fail: '#FF7B7B',
};

export default function App() {
  const [results, setResults] = useState<Partial<Record<CheckId, Result>>>({});
  const [copied, setCopied] = useState(false);

  const run = useCallback(async (id: CheckId) => {
    setResults((r) => ({ ...r, [id]: { status: 'running', lines: [] } }));
    let res: Result;
    try {
      res = await RUNNERS[id]();
    } catch (e) {
      res = { status: 'fail', lines: [`Unexpected error: ${errText(e)}`] };
    }
    setResults((r) => ({ ...r, [id]: res }));
  }, []);

  const runAll = useCallback(async () => {
    // One at a time: each can show an iOS permission sheet.
    for (const c of CHECKS) await run(c.id);
  }, [run]);

  const copyReport = useCallback(async () => {
    const body = CHECKS.map((c) => {
      const r = results[c.id];
      return `${c.title}: ${r?.status ?? 'not run'}\n${(r?.lines ?? []).map((l) => `  ${l}`).join('\n')}`;
    }).join('\n');
    await Clipboard.setStringAsync(`DUO phase 0 report ${new Date().toISOString()}\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [results]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.kicker}>DUO · phase 0</Text>
        <Text style={s.h1}>Phone checks</Text>
        <Text style={s.lead}>Run all four, then copy the report and paste it to Claude. Nothing is sent anywhere.</Text>
        {Platform.OS === 'web' ? (
          <Text style={s.preview}>Browser preview: phone features are simulated. Layout and flow match the phone.</Text>
        ) : null}

        <Pressable accessibilityRole="button" onPress={runAll} style={({ pressed }) => [s.primary, pressed && s.pressed]}>
          <Text style={s.primaryText}>Run all checks</Text>
        </Pressable>

        {CHECKS.map((c) => {
          const r = results[c.id];
          const color = r ? { idle: C.muted, running: C.accent, pass: C.pass, warn: C.warn, fail: C.fail }[r.status] : C.muted;
          return (
            <View key={c.id} style={s.card}>
              <View style={s.row}>
                <Text style={s.title}>{c.title}</Text>
                <Text style={[s.badge, { color }]}>{r ? (r.status === 'running' ? 'running…' : r.status.toUpperCase()) : 'not run'}</Text>
              </View>
              <Text style={s.what}>{c.what}</Text>
              {r?.lines.map((l, i) => (
                <Text key={i} style={s.line} selectable>
                  {l}
                </Text>
              ))}
              <Pressable accessibilityRole="button" onPress={() => run(c.id)} style={({ pressed }) => [s.secondary, pressed && s.pressed]}>
                <Text style={s.secondaryText}>Run this check</Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable accessibilityRole="button" onPress={copyReport} style={({ pressed }) => [s.secondary, s.copy, pressed && s.pressed]}>
          <Text style={s.secondaryText}>{copied ? 'Copied ✓' : 'Copy report'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 48, gap: 14 },
  kicker: { color: C.muted, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' },
  h1: { color: C.text, fontSize: 30, fontWeight: '700' },
  lead: { color: C.muted, fontSize: 15, lineHeight: 21 },
  primary: { backgroundColor: C.accent, minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: C.bg, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: C.text, fontSize: 17, fontWeight: '600' },
  badge: { fontSize: 13, fontWeight: '700' },
  what: { color: C.muted, fontSize: 14, lineHeight: 19 },
  line: { color: C.text, fontSize: 13, lineHeight: 19, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  secondary: { minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: '#2E3846', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryText: { color: C.text, fontSize: 15 },
  copy: { marginTop: 8 },
  preview: { color: C.warn, fontSize: 13, lineHeight: 18, borderWidth: 1, borderColor: C.warn, borderRadius: 12, padding: 10 },
});
