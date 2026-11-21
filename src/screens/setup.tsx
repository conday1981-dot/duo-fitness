/** First run, app lock, settings, backup/restore and phone checks. */
import { useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../core/store';
import type { Profile, Sex, ThemeName, Units } from '../core/types';
import { num, uid, ymd } from '../core/util';
import { Button, Card, Field, Label, ListItem, Notice, Row, Screen, Segmented, Sheet, Txt, useTheme } from '../ui/kit';
import { useNav } from '../ui/nav';
import { makeBackup, readBackup } from '../domain/backup';
import { pickTextFile, saveFile } from '../platform/device';
import { RUNNERS } from '../checks';
import { CHECKS, type Result } from '../types';

function ProfileForm({ initial, onSave, cta }: { initial?: Partial<Profile>; onSave: (p: Profile) => void; cta: string }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [sex, setSex] = useState<Sex>(initial?.sex ?? 'male');
  const [theme, setTheme] = useState<ThemeName>(initial?.theme ?? (initial?.sex === 'female' ? 'honey' : 'con'));
  const [units, setUnits] = useState<Units>(initial?.units ?? 'metric');
  const [height, setHeight] = useState(initial?.heightCm ? String(initial.heightCm) : '');
  return (
    <View style={{ gap: 14 }}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
      <View style={{ gap: 6 }}>
        <Txt size={13}>Body diagrams and figures</Txt>
        <Segmented value={sex} onChange={(v) => { setSex(v); if (!initial?.theme) setTheme(v === 'female' ? 'honey' : 'con'); }} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
      </View>
      <View style={{ gap: 6 }}>
        <Txt size={13}>Theme</Txt>
        <Segmented value={theme} onChange={setTheme} options={[{ value: 'con', label: 'Graphite + cyan' }, { value: 'honey', label: 'Honey' }]} />
      </View>
      <View style={{ gap: 6 }}>
        <Txt size={13}>Units</Txt>
        <Segmented value={units} onChange={setUnits} options={[{ value: 'metric', label: 'kg · km · cm' }, { value: 'imperial', label: 'lb · mi · in' }]} />
      </View>
      <Field label="Height (cm, optional)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="e.g. 180" />
      <Button title={cta} disabled={!name.trim()} onPress={() => onSave({ id: initial?.id ?? uid(), name: name.trim(), sex, theme, units, heightCm: num(height), createdAt: initial?.createdAt ?? Date.now() })} />
    </View>
  );
}

export function Onboarding() {
  const { update } = useStore();
  return (
    <Screen kicker="Welcome to DUO" title="Who’s this phone for?" back={false}>
      <Txt color={useTheme().soft}>Everything you log stays on this phone. You can link with your partner’s phone later from the Buddy tab.</Txt>
      <Card>
        <ProfileForm cta="Start" onSave={(p) => update((d) => { d.profiles.push(p); d.activeProfileId = p.id; })} />
      </Card>
    </Screen>
  );
}

export function LockScreen() {
  const { unlock } = useStore();
  const t = useTheme();
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const ok = await unlock(pass);
    setBusy(false);
    if (!ok) { setErr('That passcode isn’t right.'); setPass(''); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center', padding: 28, gap: 16 }}>
      <Txt size={30} weight="700" center>DUO</Txt>
      <Txt color={t.soft} center>Enter your passcode</Txt>
      <Field value={pass} onChangeText={(s) => { setPass(s); setErr(''); }} secureTextEntry keyboardType="number-pad" placeholder="Passcode" onSubmitEditing={go} autoFocus />
      {err ? <Txt color={t.bad} center>{err}</Txt> : null}
      <Button title={busy ? 'Checking…' : 'Unlock'} onPress={go} disabled={!pass || busy} />
    </View>
  );
}

function PasscodeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { setLock, data } = useStore();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  const save = async (remove?: boolean) => {
    try {
      await setLock(remove ? undefined : a);
      setA(''); setB(''); setErr(''); onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="App passcode">
      <Txt size={14}>Asked for whenever DUO opens. It also encrypts your progress photos. If you forget it, only a backup can bring your data back.</Txt>
      <Field label="New passcode (4+ digits)" value={a} onChangeText={setA} secureTextEntry keyboardType="number-pad" />
      <Field label="Repeat it" value={b} onChangeText={setB} secureTextEntry keyboardType="number-pad" />
      {err ? <Notice tone="warn">{err}</Notice> : null}
      <Button title="Save passcode" disabled={a.length < 4 || a !== b} onPress={() => save()} />
      {data.settings.lockHash ? <Button kind="secondary" title="Turn off the passcode" onPress={() => save(true)} /> : null}
    </Sheet>
  );
}

function BackupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data, rawPhotos, privateSealedForBackup, replaceAll } = useStore();
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try { setMsg(await fn()); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const backup = () => run(async () => {
    const file = await makeBackup({ data, photos: await rawPhotos(), privateSealed: await privateSealedForBackup() }, pass);
    const r = await saveFile(`duo-backup-${ymd()}.duo.json`, file, 'application/json');
    return r === 'failed' ? 'Couldn’t save the file here. On the installed app, the share sheet lets you save it to Files or iCloud Drive.' : 'Backup saved. Keep the passphrase somewhere safe: without it the file can’t be opened.';
  });
  const restore = () => run(async () => {
    const f = await pickTextFile('.json,application/json');
    if (!f) return '';
    const c = await readBackup(f.text, pass);
    await replaceAll(c.data, c.photos, c.privateSealed);
    return `Restored ${c.data.workouts.length} workouts, ${c.data.readings.length} readings and ${Object.keys(c.photos).length} photos.`;
  });
  return (
    <Sheet visible={visible} onClose={onClose} title="Backup and restore">
      <Txt size={14}>One encrypted file with everything: workouts, readings, goals, photos and the private section (which stays locked with its own passcode inside the file).</Txt>
      <Field label="Backup passphrase (8+ characters)" value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" />
      <Button title={busy ? 'Working…' : 'Save a backup'} icon="share" disabled={pass.length < 8 || busy} onPress={backup} />
      <Button kind="secondary" title="Restore from a backup" icon="upload" disabled={pass.length < 8 || busy} onPress={restore} />
      <Txt size={13} color={useTheme().muted}>Restoring replaces what’s on this phone.</Txt>
      {msg ? <Notice>{msg}</Notice> : null}
    </Sheet>
  );
}

export function Settings() {
  const { data, profile, update, lockNow, privateEnabled } = useStore();
  const nav = useNav();
  const t = useTheme();
  const [sheet, setSheet] = useState<'' | 'profile' | 'add' | 'pass' | 'backup'>('');
  const s = data.settings;
  return (
    <Screen title="Settings">
      <Label>Profile</Label>
      <ListItem icon="users" title={profile?.name ?? ''} sub={`${profile?.theme === 'honey' ? 'Honey' : 'Graphite + cyan'} · ${profile?.units === 'imperial' ? 'lb, mi' : 'kg, km'}`} onPress={() => setSheet('profile')} />
      {data.profiles.length > 1 ? (
        <Card>
          <Txt size={14} color={t.soft}>Switch profile on this phone</Txt>
          <Row wrap>
            {data.profiles.map((p) => <Button key={p.id} small kind={p.id === profile?.id ? 'primary' : 'secondary'} title={p.name} onPress={() => update((d) => { d.activeProfileId = p.id; })} />)}
          </Row>
        </Card>
      ) : null}
      <ListItem icon="plus" title="Add a second profile" sub="For sharing one phone" onPress={() => setSheet('add')} />

      <Label>Privacy</Label>
      <ListItem icon="lock" title="App passcode" sub={s.lockHash ? 'On' : 'Off'} onPress={() => setSheet('pass')} />
      {s.lockHash ? <Button kind="secondary" title="Lock now" onPress={lockNow} /> : null}
      <ListItem icon="heart" iconColor="#F5C400" title="Private" sub={privateEnabled ? 'Locked with its own passcode' : 'Off · for the two of you'} onPress={() => nav.push('private')} />
      <ListItem icon="share" title="Backup and restore" sub="Encrypted file you keep" onPress={() => setSheet('backup')} />

      <Label>Training</Label>
      <Card>
        <Field label="Weekly target (active days)" value={String(s.weeklyTarget)} onChangeText={(v) => update((d) => { d.settings.weeklyTarget = Math.max(1, Math.min(7, num(v) ?? 3)); })} keyboardType="number-pad" />
        <Field label="Default rest timer (seconds)" value={String(s.restSeconds)} onChangeText={(v) => update((d) => { d.settings.restSeconds = Math.max(15, num(v) ?? 120); })} keyboardType="number-pad" />
        <Field label="Bar weight (kg)" value={String(s.barKg)} onChangeText={(v) => update((d) => { d.settings.barKg = num(v) ?? 20; })} keyboardType="decimal-pad" />
      </Card>

      <Label>Advanced</Label>
      <Card>
        <Field label="Sync relay address (blank = this site)" value={s.relayUrl ?? ''} onChangeText={(v) => update((d) => { d.settings.relayUrl = v.trim() || undefined; })} autoCapitalize="none" placeholder="https://…" />
      </Card>
      <ListItem icon="settings" title="Phone checks" sub="Health, location and text recognition tests" onPress={() => nav.push('diagnostics')} />
      <Txt size={12} color={t.muted}>DUO keeps your data on this phone. Nothing is sent anywhere except encrypted buddy sync, if you pair.</Txt>

      <Sheet visible={sheet === 'profile'} onClose={() => setSheet('')} title="Edit profile">
        {profile ? <ProfileForm initial={profile} cta="Save" onSave={(p) => { update((d) => { d.profiles = d.profiles.map((x) => (x.id === p.id ? p : x)); }); setSheet(''); }} /> : null}
      </Sheet>
      <Sheet visible={sheet === 'add'} onClose={() => setSheet('')} title="Add a profile">
        <ProfileForm cta="Add and switch" onSave={(p) => { update((d) => { d.profiles.push(p); d.activeProfileId = p.id; }); setSheet(''); }} />
      </Sheet>
      <PasscodeSheet visible={sheet === 'pass'} onClose={() => setSheet('')} />
      <BackupSheet visible={sheet === 'backup'} onClose={() => setSheet('')} />
    </Screen>
  );
}

export function Diagnostics() {
  const t = useTheme();
  const [results, setResults] = useState<Partial<Record<(typeof CHECKS)[number]['id'], Result>>>({});
  const run = async (id: (typeof CHECKS)[number]['id']) => {
    setResults((r) => ({ ...r, [id]: { status: 'running', lines: [] } }));
    let res: Result;
    try { res = await RUNNERS[id](); } catch (e) { res = { status: 'fail', lines: [(e as Error).message] }; }
    setResults((r) => ({ ...r, [id]: res }));
  };
  return (
    <Screen title="Phone checks">
      <Txt color={t.soft}>Tests what DUO can use on this phone. Nothing leaves the phone.</Txt>
      {CHECKS.map((c) => {
        const r = results[c.id];
        return (
          <Card key={c.id}>
            <Row><Txt weight="600" style={{ flex: 1 }}>{c.title}</Txt><Txt size={13} color={r?.status === 'pass' ? t.good : r?.status === 'fail' ? t.bad : t.muted}>{r?.status ?? 'not run'}</Txt></Row>
            <Txt size={13} color={t.muted}>{c.what}</Txt>
            {r?.lines.map((l, i) => <Txt key={i} size={13}>{l}</Txt>)}
            <Button small kind="secondary" title="Run" onPress={() => run(c.id)} />
          </Card>
        );
      })}
    </Screen>
  );
}

