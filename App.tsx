/**
 * DUO – private, local-first fitness app for two (see docs/design.md).
 * Shell: storage + theme + lock gates, five tabs, and the route switch.
 */
import { useEffect, type ReactNode } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider, useStore } from './src/core/store';
import { palettes } from './src/core/theme';
import { ThemeCtx, Txt, useTheme } from './src/ui/kit';
import { Icon, type IconName } from './src/ui/Icon';
import { NavProvider, useNav, type Tab } from './src/ui/nav';
import { Today } from './src/screens/today';
import { ExerciseDetail, Exercises, Plates, Programmes, Train, WorkoutScreen } from './src/screens/train';
import { CardioDetail, CardioHome, Run } from './src/screens/cardio';
import { Body, ImportScreen } from './src/screens/body';
import { Goals, Plan, ProgressScreen, Reminders } from './src/screens/plan';
import { Buddy } from './src/screens/buddy';
import { Diagnostics, LockScreen, Onboarding, Settings } from './src/screens/setup';
import { PrivateRoot } from './src/screens/private';
import type { CardioType, IntervalStep } from './src/core/types';

const TABS: { tab: Tab; label: string; icon: IconName }[] = [
  { tab: 'today', label: 'Today', icon: 'home' },
  { tab: 'train', label: 'Train', icon: 'dumbbell' },
  { tab: 'body', label: 'Body', icon: 'chart' },
  { tab: 'buddy', label: 'Buddy', icon: 'users' },
  { tab: 'plan', label: 'Plan', icon: 'calendar' },
];

function TabBar() {
  const t = useTheme();
  const nav = useNav();
  const { data } = useStore();
  const unseen = data.cheers.some((c) => !c.seen);
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.card, borderTopWidth: 1, borderColor: t.line, paddingTop: 8, paddingBottom: 26 }}>
      {TABS.map((x) => {
        const on = nav.tab === x.tab;
        return (
          <Pressable key={x.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={x.label} onPress={() => nav.setTab(x.tab)} style={{ flex: 1, alignItems: 'center', gap: 3, minHeight: 44 }}>
            <View>
              <Icon name={x.icon} color={on ? t.accent : t.muted} />
              {x.tab === 'buddy' && unseen ? <View style={{ position: 'absolute', top: -2, right: -4, width: 9, height: 9, borderRadius: 5, backgroundColor: t.partner }} /> : null}
            </View>
            <Txt size={11} color={on ? t.accent : t.muted}>{x.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

function Routes() {
  const { route } = useNav();
  const p = (route.params ?? {}) as Record<string, unknown>;
  const map: Record<string, () => ReactNode> = {
    today: () => <Today />,
    train: () => <Train />,
    body: () => <Body />,
    buddy: () => <Buddy />,
    plan: () => <Plan />,
    workout: () => <WorkoutScreen id={p.id as string} />,
    exercises: () => <Exercises />,
    exercise: () => <ExerciseDetail id={p.id as string} />,
    programmes: () => <Programmes />,
    plates: () => <Plates />,
    cardio: () => <CardioHome />,
    run: () => <Run type={(p.type as CardioType) ?? 'run'} steps={p.steps as IntervalStep[] | undefined} programmeId={p.programmeId as string | undefined} dayIndex={p.dayIndex as number | undefined} routeTargetM={p.routeTargetM as number | undefined} />,
    cardioDetail: () => <CardioDetail id={p.id as string} />,
    import: () => <ImportScreen />,
    goals: () => <Goals />,
    progress: () => <ProgressScreen />,
    reminders: () => <Reminders />,
    settings: () => <Settings />,
    diagnostics: () => <Diagnostics />,
    private: () => <PrivateRoot />,
    privateEntry: () => <PrivateRoot screen="entry" id={p.id as string} />,
  };
  return <>{(map[route.name] ?? map.today)()}</>;
}

function Shell() {
  const { ready, data, profile, locked, lockNow } = useStore();
  const theme = palettes[profile?.theme ?? 'con'];

  // Leaving the app locks it (and always closes the private section).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'background') lockNow(); });
    return () => sub.remove();
  }, [lockNow]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  return (
    <ThemeCtx.Provider value={theme}>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <NavProvider>
          {locked ? <LockScreen /> : !data.profiles.length ? <Onboarding /> : (
            <>
              <View style={{ flex: 1 }}><Routes /></View>
              <TabBar />
            </>
          )}
        </NavProvider>
      </View>
    </ThemeCtx.Provider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
