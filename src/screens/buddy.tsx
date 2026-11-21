/** Buddy tab: pair phones, compare, joint challenges, cheers. */
import { useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../core/store';
import { addDays, niceDate, num, uid, ymd } from '../core/util';
import { mailboxFor, newDeviceId, newPairing, pairingCode, parsePairingCode } from '../domain/sync';
import { activeDays, challengeTotal, dayStreak, thisWeekCount } from '../domain/progress';
import { bests } from '../domain/training';
import { Button, Card, Chip, Empty, Field, Label, ListItem, Notice, ProgressBar, Row, Screen, Segmented, Sheet, Txt, useNow, useTheme } from '../ui/kit';
import { saveFile } from '../platform/device';

/** "just now", "12 min ago", "14:05" or a date. */
function syncedAt(t: number, now: number): string {
  const mins = Math.round((now - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const d = new Date(t);
  return ymd(t) === ymd(now) ? `at ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : niceDate(t);
}

const CHEERS = ['Nice one!', 'Proud of you', 'Keep going', 'Beat that PR!', 'Workout together later?'];

function Pair() {
  const { update } = useStore();
  const t = useTheme();
  const [mode, setMode] = useState<'make' | 'enter'>('make');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<ReturnType<typeof newPairing>>();
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const make = () => setPending(newPairing(newDeviceId()));
  const confirmMade = () => pending && update((d) => { d.pairing = pending; });
  const enter = () => {
    try {
      const key = parsePairingCode(code);
      update((d) => { d.pairing = { coupleKey: key, mailbox: mailboxFor(key), deviceId: newDeviceId(), pairedAt: Date.now() }; });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <>
      <Txt color={t.soft}>Pair once, then your two phones share progress through your own relay. Everything is encrypted on the phone before it leaves, with a key only your two phones have.</Txt>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'make', label: 'Make a code' }, { value: 'enter', label: 'Enter a code' }]} />
      {mode === 'make' ? (
        <Card>
          {!pending ? (
            <>
              <Txt>On one phone, make a pairing code. Send it to the other phone (AirDrop or Messages), then enter it there.</Txt>
              <Button title="Make a pairing code" onPress={make} />
            </>
          ) : (
            <>
              <Label>Pairing code</Label>
              <Txt mono size={13} style={{ backgroundColor: t.raised, padding: 10, borderRadius: 10 }}>{pairingCode(pending.coupleKey)}</Txt>
              <Row>
                <Button flex small kind="secondary" title={copied ? 'Copied' : 'Copy'} onPress={async () => { await Clipboard.setStringAsync(pairingCode(pending.coupleKey)); setCopied(true); }} />
                <Button flex small kind="secondary" title="Share" icon="share" onPress={() => saveFile('duo-pairing.txt', pairingCode(pending.coupleKey), 'text/plain')} />
              </Row>
              <Notice tone="warn">This code is the key to your shared data. Only send it to your partner, and delete the message once you’re paired.</Notice>
              <Button title="Done: my partner has entered it" onPress={confirmMade} />
            </>
          )}
        </Card>
      ) : (
        <Card>
          <Field label="Pairing code from your partner’s phone" value={code} onChangeText={(s) => { setCode(s); setErr(''); }} autoCapitalize="none" autoCorrect={false} placeholder="DUO1.…" multiline />
          {err ? <Txt color={t.bad}>{err}</Txt> : null}
          <Button title="Pair" disabled={!code.trim()} onPress={enter} />
        </Card>
      )}
    </>
  );
}

export function Buddy() {
  const { data, profile, update, relayAvailable, syncing, syncError, syncNow, sendCheer, shareChallenge } = useStore();
  const t = useTheme();
  const [newCh, setNewCh] = useState(false);
  const now = useNow(60000);
  if (!data.pairing) return <Screen title="Buddy"><Pair /></Screen>;
  const p = data.partner;
  const pid = profile?.id;
  const ws = data.workouts.filter((w) => w.profileId === pid);
  const cs = data.cardio.filter((c) => c.profileId === pid);
  const days = activeDays(ws, cs);
  const weekAgo = now - 7 * 86400000;
  const mine = {
    workouts: thisWeekCount(days),
    distanceKm: cs.filter((c) => c.startedAt > weekAgo).reduce((a, c) => a + c.distanceM / 1000, 0),
    streak: dayStreak(days),
    prs: Object.values(bests(ws)).filter((b) => b.at > weekAgo).length,
  };
  const row = (label: string, a: string, b: string) => (
    <Row key={label}><Txt color={t.soft} style={{ flex: 1.3 }}>{label}</Txt><Txt weight="600" style={{ flex: 1 }}>{a}</Txt><Txt weight="600" style={{ flex: 1 }}>{b}</Txt></Row>
  );
  const active = data.challenges.filter((c) => c.end >= ymd());
  return (
    <Screen title="Buddy">
      <Row>
        <Txt size={13} color={syncError ? t.warn : t.muted} style={{ flex: 1 }}>
          {!relayAvailable ? 'Sync starts once DUO is on your own site.' : syncError ? syncError : syncing ? 'Syncing…' : data.pairing.lastSync ? `Synced ${syncedAt(data.pairing.lastSync, now)} · end-to-end encrypted` : 'Not synced yet'}
        </Txt>
        <Button small kind="secondary" title="Sync" icon="sync" disabled={!relayAvailable || syncing} onPress={syncNow} />
      </Row>
      {p ? (
        <>
          <Card>
            <Row><Label>This week</Label></Row>
            <Row><View style={{ flex: 1.3 }} /><Txt weight="700" color={t.accent} style={{ flex: 1 }}>{profile?.name}</Txt><Txt weight="700" color={t.partner} style={{ flex: 1 }}>{p.name}</Txt></Row>
            {row('Active days', String(mine.workouts), String(p.week.workouts))}
            {row('Distance', `${mine.distanceKm.toFixed(1)} km`, `${p.week.distanceKm.toFixed(1)} km`)}
            {row('Streak', `${mine.streak} day${mine.streak === 1 ? '' : 's'}`, `${p.week.streak} day${p.week.streak === 1 ? '' : 's'}`)}
            {row('New PRs', String(mine.prs), String(p.week.prs))}
          </Card>
          <Label>{p.name}’s activity</Label>
          {p.recent.length ? p.recent.slice(0, 5).map((r, i) => <ListItem key={i} title={r.text} sub={niceDate(r.at)} />) : <Txt color={t.muted}>Nothing yet.</Txt>}
          {p.goals?.length ? (
            <Card>
              <Label>{p.name}’s goals</Label>
              {p.goals.map((g) => <View key={g.title} style={{ gap: 4 }}><Txt size={14}>{g.title}</Txt><ProgressBar pct={g.pct} color={t.partner} /></View>)}
            </Card>
          ) : null}
        </>
      ) : <Empty title="Waiting for your partner" sub="Their stats appear after their phone syncs." />}

      <Label>Send a cheer</Label>
      <Row wrap gap={6}>{CHEERS.map((c) => <Chip key={c} label={c} onPress={() => sendCheer(c)} />)}</Row>

      <Row><Label>Challenges</Label><View style={{ flex: 1 }} /><Button small kind="ghost" title="New" icon="plus" onPress={() => setNewCh(true)} /></Row>
      {active.length ? active.map((c) => {
        const me = challengeTotal(c, ws, cs);
        const them = p?.challengeProgress?.[c.id] ?? 0;
        const unit = c.metric === 'distance' ? 'km' : 'sessions';
        return (
          <Card key={c.id}>
            <Row><Txt weight="700" style={{ flex: 1 }}>{c.title}</Txt><Txt size={13} color={t.muted}>until {niceDate(c.end)}</Txt></Row>
            <View style={{ height: 12, borderRadius: 6, backgroundColor: t.raised, flexDirection: 'row', overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(100, (me / c.target) * 100)}%`, backgroundColor: t.accent }} />
              <View style={{ width: `${Math.min(100, (them / c.target) * 100)}%`, backgroundColor: t.partner }} />
            </View>
            <Txt size={13} color={t.soft}>{(me + them).toFixed(c.metric === 'distance' ? 1 : 0)} of {c.target} {unit} · you {me} · {p?.name ?? 'partner'} {them}</Txt>
          </Card>
        );
      }) : <Txt color={t.muted}>No challenge running.</Txt>}

      <Button kind="ghost" title="Unpair this phone" onPress={() => update((d) => { d.pairing = undefined; d.partner = undefined; d.outbox = []; })} />
      <NewChallenge visible={newCh} onClose={() => setNewCh(false)} onCreate={(c) => { shareChallenge(c); setNewCh(false); }} />
    </Screen>
  );
}

function NewChallenge({ visible, onClose, onCreate }: { visible: boolean; onClose: () => void; onCreate: (c: { id: string; title: string; metric: 'distance' | 'workouts'; target: number; start: string; end: string }) => void }) {
  const [metric, setMetric] = useState<'distance' | 'workouts'>('distance');
  const [target, setTarget] = useState('100');
  const [days, setDays] = useState('30');
  const n = num(target);
  const end = addDays(ymd(), Math.max(1, num(days) ?? 30) - 1);
  return (
    <Sheet visible={visible} onClose={onClose} title="New joint challenge">
      <Segmented value={metric} onChange={setMetric} options={[{ value: 'distance', label: 'Distance (km)' }, { value: 'workouts', label: 'Sessions' }]} />
      <Field label="Target together" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      <Field label="How many days" value={days} onChangeText={setDays} keyboardType="number-pad" />
      <Button title="Start challenge" disabled={!n} onPress={() => onCreate({ id: uid(), title: `${n} ${metric === 'distance' ? 'km' : 'sessions'} together`, metric, target: n!, start: ymd(), end })} />
    </Sheet>
  );
}
