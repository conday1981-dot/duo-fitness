/**
 * Private section (design doc §9): its own passcode, sealed storage,
 * honey palette, quick-hide, auto-lock. Kept out of everything else.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { useStore } from '../core/store';
import type { IntimacyLog, WishAnswer } from '../core/types';
import { privatePalette } from '../core/theme';
import { addDays, DAYS, MONTHS, niceDate, num, parseYmd, uid, ymd } from '../core/util';
import { CATALOGUE, EFFORT_MET, fillRoles, matches, WISH_ITEMS, type CatalogueEntry } from '../domain/private';
import { kcal } from '../domain/cardio';
import { latestWeight } from '../domain/progress';
import { Button, Card, Chip, Empty, Field, IconButton, Label, ListItem, Notice, Row, Screen, Segmented, Sheet, ThemeCtx, Txt, useNow, useTheme } from '../ui/kit';
import { Bars } from '../ui/charts';
import { PoseDiagram } from '../ui/PoseDiagram';
import { useNav } from '../ui/nav';

const IDLE_MS = 2 * 60 * 1000;

type PrivTab = 'overview' | 'calendar' | 'catalogue' | 'wish';
/** Remembered while the app is open, so Back from an entry returns to the same tab. */
let lastPrivTab: PrivTab = 'overview';

function useAutoLock() {
  const { closePrivate } = useStore();
  const nav = useNav();
  const last = useRef(0);
  useEffect(() => {
    last.current = Date.now();
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') { closePrivate(); } });
    const i = setInterval(() => { if (Date.now() - last.current > IDLE_MS) { closePrivate(); nav.home(); } }, 5000);
    return () => { sub.remove(); clearInterval(i); };
  }, [closePrivate, nav]);
  return () => { last.current = Date.now(); };
}

export function PrivateRoot(props: { screen?: 'entry'; id?: string }) {
  return (
    <ThemeCtx.Provider value={privatePalette}>
      <PrivateGate {...props} />
    </ThemeCtx.Provider>
  );
}

function PrivateGate({ screen, id }: { screen?: 'entry'; id?: string }) {
  const { privateEnabled, privateOpen } = useStore();
  if (!privateEnabled) return <Setup />;
  if (!privateOpen) return <Unlock />;
  return screen === 'entry' && id ? <Entry id={id} /> : <Home />;
}

function Setup() {
  const { enablePrivate } = useStore();
  const t = useTheme();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Screen title="Private">
      <Txt color={t.soft}>A section just for the two of you. Turn it on separately on each phone.</Txt>
      <Card>
        <Txt>• Locked with its own passcode, separate from the app passcode</Txt>
        <Txt>• Encrypted on this phone, so it can’t be read even from a backup without the passcode</Txt>
        <Txt>• Never in notifications, widgets, Apple Calendar or A.M.Y AI</Txt>
        <Txt>• Locks again when you leave the app, or after 2 minutes idle</Txt>
      </Card>
      <Field label="Private passcode (6+ characters)" value={a} onChangeText={setA} secureTextEntry autoCapitalize="none" />
      <Field label="Repeat it" value={b} onChangeText={setB} secureTextEntry autoCapitalize="none" />
      <Notice tone="warn">If you forget this passcode, the private section can’t be recovered.</Notice>
      <Button title={busy ? 'Setting up…' : 'Turn on'} disabled={a.length < 6 || a !== b || busy} onPress={async () => { setBusy(true); await enablePrivate(a); setBusy(false); }} />
    </Screen>
  );
}

function Unlock() {
  const { openPrivate } = useStore();
  const t = useTheme();
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const ok = await openPrivate(p);
    setBusy(false);
    if (!ok) { setErr('That passcode isn’t right.'); setP(''); }
  };
  return (
    <Screen title="Private">
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 30 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 1, borderColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={30} color={t.accent}>•••</Txt>
        </View>
        <Txt color={t.soft} center>Just for the two of you.</Txt>
      </View>
      <Field value={p} onChangeText={(s) => { setP(s); setErr(''); }} secureTextEntry placeholder="Private passcode" autoCapitalize="none" onSubmitEditing={go} autoFocus />
      {err ? <Txt color={t.bad}>{err}</Txt> : null}
      <Button title={busy ? 'Unlocking…' : 'Unlock'} disabled={!p || busy} onPress={go} />
    </Screen>
  );
}

function Home() {
  const { closePrivate, priv } = useStore();
  const nav = useNav();
  const t = useTheme();
  const touch = useAutoLock();
  const [tab, setTabState] = useState<PrivTab>(lastPrivTab);
  const setTab = (t2: PrivTab) => { lastPrivTab = t2; setTabState(t2); };
  const hide = () => { closePrivate(); nav.home(); };
  return (
    <Pressable style={{ flex: 1 }} onPressIn={touch} accessible={false}>
      <Screen title="Private" right={<Row gap={6}><IconButton icon="eyeOff" label="Quick hide" onPress={hide} /><IconButton icon="lock" label="Lock now" onPress={closePrivate} /></Row>}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'overview', label: 'Overview' }, { value: 'calendar', label: 'Calendar' }, { value: 'catalogue', label: 'Catalogue' }, { value: 'wish', label: 'Wish list' }]} />
        {tab === 'overview' ? <Overview /> : tab === 'calendar' ? <PrivCalendar /> : tab === 'catalogue' ? <Catalogue /> : <Wish />}
        <Txt size={12} color={t.muted}>{priv.logs.length} entries · encrypted on this phone</Txt>
      </Screen>
    </Pressable>
  );
}

function Overview() {
  const { priv, updatePrivate, data } = useStore();
  const t = useTheme();
  const [log, setLog] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  const nowMs = useNow(60000);
  const now = new Date(nowMs);
  const monthKey = ymd(new Date(now.getFullYear(), now.getMonth(), 1)).slice(0, 7);
  const thisMonth = priv.logs.filter((l) => ymd(l.at).startsWith(monthKey));
  const threeMonths = priv.logs.filter((l) => l.at > nowMs - 90 * 86400000).length / 3;
  const weekly = [0, 1, 2, 3].map((w) => thisMonth.filter((l) => Math.floor((new Date(l.at).getDate() - 1) / 7) === w).length);
  const byDay = DAYS.map((_, i) => priv.logs.filter((l) => (new Date(l.at).getDay() + 6) % 7 === i).length);
  const topDay = priv.logs.length ? DAYS[byDay.indexOf(Math.max(...byDay))] : undefined;
  const lastGap = priv.logs.length ? Math.floor((nowMs - Math.max(...priv.logs.map((l) => l.at))) / 86400000) : undefined;
  const m = matches(priv.wish, priv.partnerWish).length;
  const upcoming = priv.dates.filter((d) => d.date >= ymd()).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Label>{MONTHS[now.getMonth()]} so far</Label>
            <Txt size={38} weight="700">{thisMonth.length} <Txt size={16} color={t.soft}>times</Txt></Txt>
          </View>
          <Txt size={13} color={t.soft} style={{ textAlign: 'right' }}>3-month average{'\n'}{threeMonths.toFixed(1)} a month</Txt>
        </Row>
        <Bars values={weekly} labels={['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4+']} height={56} />
        {topDay ? <Txt size={13} color={t.soft}>Most often on {topDay}s{lastGap != null ? ` · last time ${lastGap === 0 ? 'today' : `${lastGap} day${lastGap > 1 ? 's' : ''} ago`}` : ''}</Txt> : null}
      </Card>
      <Button title="Log a moment" icon="plus" onPress={() => setLog(true)} />
      <ListItem icon="heart" title={m ? `${m} wish-list match${m > 1 ? 'es' : ''}` : 'Wish list'} sub={priv.partnerWish.length ? 'Things you both said yes or maybe to' : data.pairing ? 'Waiting for your partner’s answers' : 'Pair in Buddy to compare'} />
      <Row><Label>Date nights</Label><View style={{ flex: 1 }} /><Button small kind="ghost" title="Plan one" icon="plus" onPress={() => setDateSheet(true)} /></Row>
      {upcoming.length ? upcoming.map((d) => <ListItem key={d.id} icon="calendar" title={d.title} sub={`${niceDate(d.date)}${d.note ? ` · ${d.note}` : ''}`} right={<Button small kind="ghost" title="Remove" onPress={() => updatePrivate((p) => { p.dates = p.dates.filter((x) => x.id !== d.id); })} />} />) : <Txt color={t.muted}>Nothing planned.</Txt>}
      <LogSheet visible={log} onClose={() => setLog(false)} />
      <DateSheet visible={dateSheet} onClose={() => setDateSheet(false)} />
    </>
  );
}

function LogSheet({ visible, onClose, preset }: { visible: boolean; onClose: () => void; preset?: string }) {
  const { updatePrivate, data } = useStore();
  const t = useTheme();
  const [acts, setActs] = useState<string[]>(preset ? [preset] : []);
  const [when, setWhen] = useState(ymd());
  const [mins, setMins] = useState('');
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const save = () => {
    const at = parseYmd(when).getTime() + (when === ymd() ? Date.now() - parseYmd(ymd()).getTime() : 20 * 3600000);
    const log: IntimacyLog = { id: uid(), at, acts, mins: num(mins), rating: rating || undefined, note: note.trim() || undefined, by: data.pairing?.deviceId ?? 'this-phone' };
    const shared = { ...log, rating: undefined, note: undefined }; // rating and note stay on this phone
    updatePrivate((p) => { p.logs.push(log); }, { kind: 'log', payload: shared });
    setActs([]); setMins(''); setRating(0); setNote(''); onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Log a moment">
      <Field label="Date (YYYY-MM-DD)" value={when} onChangeText={setWhen} />
      <Label>What (optional)</Label>
      <Row wrap gap={6}>{CATALOGUE.map((c) => <Chip key={c.id} label={c.name} on={acts.includes(c.id)} onPress={() => setActs((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} />)}</Row>
      <Field label="Minutes (optional)" value={mins} onChangeText={setMins} keyboardType="number-pad" />
      <Label>Your rating (only you see this)</Label>
      <Row gap={6}>{[1, 2, 3, 4, 5].map((n) => <Chip key={n} label={String(n)} on={rating === n} onPress={() => setRating(rating === n ? 0 : n)} />)}</Row>
      <Field label="Private note (only on this phone)" value={note} onChangeText={setNote} multiline />
      <Txt size={12} color={t.muted}>Your partner sees the date and what you picked, not your rating or note.</Txt>
      <Button title="Save" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(when)} onPress={save} />
    </Sheet>
  );
}

function DateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { updatePrivate } = useStore();
  const [date, setDate] = useState(addDays(ymd(), 7));
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  return (
    <Sheet visible={visible} onClose={onClose} title="Plan a date night">
      <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <Field label="What" value={title} onChangeText={setTitle} placeholder="Dinner at home, then a film" />
      <Field label="Notes" value={note} onChangeText={setNote} />
      <Button title="Save" disabled={!title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)} onPress={() => {
        const dp = { id: uid(), date, title: title.trim(), note: note.trim() || undefined };
        updatePrivate((p) => { p.dates.push(dp); }, { kind: 'date', payload: dp });
        setTitle(''); setNote(''); onClose();
      }} />
    </Sheet>
  );
}

function PrivCalendar() {
  const { priv, updatePrivate, data, profile } = useStore();
  const t = useTheme();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = ymd(month);
  const lead = (month.getDay() + 6) % 7;
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const logDays = useMemo(() => new Set(priv.logs.map((l) => ymd(l.at))), [priv.logs]);
  const dateDays = new Set(priv.dates.map((d) => d.date));
  const fit = useMemo(() => new Set([...data.workouts.filter((w) => w.profileId === profile?.id && w.endedAt).map((w) => ymd(w.startedAt)), ...data.cardio.filter((c) => c.profileId === profile?.id).map((c) => ymd(c.startedAt))]), [data.workouts, data.cardio, profile?.id]);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => addDays(first, i))];
  return (
    <>
      <Row>
        <IconButton icon="back" label="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
        <Txt size={17} weight="700" center style={{ flex: 1 }}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Txt>
        <IconButton icon="chevron" label="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
      </Row>
      <View style={{ flexDirection: 'row' }}>{DAYS.map((d) => <Txt key={d} size={12} color={t.muted} center style={{ flex: 1 }}>{d[0]}</Txt>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((c, i) => c ? (
          <View key={c} style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={14} color={c > ymd() ? t.muted : t.text}>{parseYmd(c).getDate()}</Txt>
            <View style={{ flexDirection: 'row', gap: 3, height: 7 }}>
              {logDays.has(c) ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.accent }} /> : null}
              {dateDays.has(c) ? <View style={{ width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: t.accent }} /> : null}
              {priv.showFitness && fit.has(c) ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3DD6F5' }} /> : null}
            </View>
          </View>
        ) : <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 44 }} />)}
      </View>
      <Row wrap gap={12}>
        <Row gap={5}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent }} /><Txt size={12} color={t.soft}>Logged</Txt></Row>
        <Row gap={5}><View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: t.accent }} /><Txt size={12} color={t.soft}>Date night</Txt></Row>
        {priv.showFitness ? <Row gap={5}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3DD6F5' }} /><Txt size={12} color={t.soft}>Workout</Txt></Row> : null}
      </Row>
      <Button small kind="secondary" title={priv.showFitness ? 'Hide fitness days' : 'Show fitness days'} onPress={() => updatePrivate((p) => { p.showFitness = !p.showFitness; })} />
    </>
  );
}

function Catalogue() {
  const { priv } = useStore();
  const nav = useNav();
  const t = useTheme();
  const [cat, setCat] = useState<CatalogueEntry['category'] | 'fav'>('Positions');
  const list = cat === 'fav' ? CATALOGUE.filter((c) => priv.favourites.includes(c.id) || priv.wantToTry.includes(c.id)) : CATALOGUE.filter((c) => c.category === cat);
  return (
    <>
      <Row wrap gap={6}>
        {(['Positions', 'Touch', 'Connection'] as const).map((c) => <Chip key={c} label={c} on={cat === c} onPress={() => setCat(c)} />)}
        <Chip label="Favourites" on={cat === 'fav'} onPress={() => setCat('fav')} />
      </Row>
      {list.length ? list.map((c) => <ListItem key={c.id} title={c.name} sub={c.tags.join(' · ')} onPress={() => nav.push('privateEntry', { id: c.id })} right={priv.favourites.includes(c.id) ? <Txt color={t.accent}>★</Txt> : undefined} />) : <Empty title="Nothing here yet" sub="Tap the heart on an entry to add it." />}
      <Txt size={12} color={t.muted}>Written as a plain, practical guide. Add your own entries and notes from any entry.</Txt>
    </>
  );
}

function Entry({ id }: { id: string }) {
  const { priv, updatePrivate, data, profile } = useStore();
  const t = useTheme();
  const touch = useAutoLock();
  const [herFront, setHerFront] = useState(true);
  const [log, setLog] = useState(false);
  const e = CATALOGUE.find((c) => c.id === id);
  if (!e) return <Screen title="Private"><Empty title="Not found" /></Screen>;
  const front: 'Her' | 'Him' = herFront ? 'Her' : 'Him';
  const back: 'Her' | 'Him' = herFront ? 'Him' : 'Her';
  const her = '#F5C400';
  const him = '#8FB3D9';
  const fav = priv.favourites.includes(id);
  const want = priv.wantToTry.includes(id);
  const kg = profile ? latestWeight(data.readings, profile.id) : undefined;
  const toggle = (key: 'favourites' | 'wantToTry') => updatePrivate((p) => { p[key] = p[key].includes(id) ? p[key].filter((x) => x !== id) : [...p[key], id]; });
  return (
    <Pressable style={{ flex: 1 }} onPressIn={touch} accessible={false}>
      <Screen kicker={`Catalogue · ${e.category}`} title={e.name} right={<IconButton icon="heart" label={fav ? 'Remove from favourites' : 'Add to favourites'} color={fav ? t.accent : t.soft} onPress={() => toggle('favourites')} />}>
        {e.pose ? (
          <Card>
            <Row><Label>{e.pose === 'spoon' ? 'View from above' : 'View from the side'}</Label><View style={{ flex: 1 }} /><Button small kind="secondary" title="Swap who’s in front" onPress={() => setHerFront((x) => !x)} /></Row>
            <PoseDiagram pose={e.pose} frontColor={herFront ? her : him} backColor={herFront ? him : her} frontLabel={front} backLabel={back} />
            <Row gap={14}>
              <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: herFront ? her : him }} /><Txt size={13}>{front} · {e.pose === 'spoon' || e.pose === 'behind' ? 'in front' : 'below'}</Txt></Row>
              <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: herFront ? him : her }} /><Txt size={13}>{back} · {e.pose === 'spoon' || e.pose === 'behind' ? 'behind' : 'above'}</Txt></Row>
            </Row>
          </Card>
        ) : null}
        <Row wrap gap={6}>{e.tags.map((g) => <Chip key={g} label={g} />)}</Row>
        <Txt color={t.soft}>{e.about}</Txt>
        {e.steps ? (
          <Card>
            <Label>How to</Label>
            {e.steps.map((s, i) => (
              <Row key={i} gap={12} style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}><Txt size={12} weight="700" color={t.onAccent}>{i + 1}</Txt></View>
                <Txt size={14} style={{ flex: 1 }}>{fillRoles(s, front, back)}</Txt>
              </Row>
            ))}
          </Card>
        ) : null}
        <Card>
          <Label>Tips</Label>
          {e.tips.map((tip) => <Txt key={tip} size={14}>• {fillRoles(tip, front, back)}</Txt>)}
        </Card>
        <Card>
          {e.works ? <Txt size={14}>Works: {e.works}</Txt> : null}
          <Txt size={13} color={t.muted}>{kg ? `≈ ${Math.max(1, kcal(EFFORT_MET[e.effort], kg, 60))} kcal a minute · ` : ''}estimate ({e.effort} effort), Compendium of Physical Activities</Txt>
        </Card>
        <Row>
          <Button flex kind="secondary" title={want ? 'On your list' : 'Want to try'} onPress={() => toggle('wantToTry')} />
          <Button flex title="Log with this" onPress={() => setLog(true)} />
        </Row>
        <LogSheet visible={log} onClose={() => setLog(false)} preset={id} />
      </Screen>
    </Pressable>
  );
}

function Wish() {
  const { priv, updatePrivate, data } = useStore();
  const t = useTheme();
  const [draft, setDraft] = useState<WishAnswer[]>(priv.wish);
  const m = matches(draft, priv.partnerWish);
  const set = (itemId: string, answer: WishAnswer['answer']) => setDraft((d) => [...d.filter((x) => x.itemId !== itemId), { itemId, answer }]);
  return (
    <>
      <Txt color={t.soft}>Answer privately. When you save, DUO compares your answers with your partner’s on the phone and only shows things you both said yes or maybe to.</Txt>
      {m.length ? (
        <Card>
          <Label>Matches</Label>
          {m.map((id) => <Txt key={id}>♥ {WISH_ITEMS.find((w) => w.id === id)?.text}</Txt>)}
        </Card>
      ) : null}
      {WISH_ITEMS.map((w) => {
        const a = draft.find((x) => x.itemId === w.id)?.answer;
        return (
          <Card key={w.id}>
            <Txt weight="600">{w.text}</Txt>
            <Row gap={6}>{(['yes', 'maybe', 'no'] as const).map((k) => <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} on={a === k} onPress={() => set(w.id, k)} />)}</Row>
          </Card>
        );
      })}
      <Button title="Save my answers" onPress={() => updatePrivate((p) => { p.wish = draft; }, { kind: 'wish', payload: draft })} />
      <Txt size={12} color={t.muted}>{data.pairing ? 'Your answers are sent to your partner’s phone encrypted. The app only shows matches, but your partner’s phone does hold your answers.' : 'Pair in Buddy to compare answers.'}</Txt>
    </>
  );
}
