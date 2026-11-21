/**
 * Private section content (design doc §9). Plain, educational wording:
 * what it is, how to set it up comfortably, and practical tips.
 * Diagrams are jointed mannequins with no anatomical detail (see ui/PoseDiagram).
 */
export type Effort = 'light' | 'moderate' | 'active';
export type PoseId = 'spoon' | 'missionary' | 'on-top' | 'behind';

export interface CatalogueEntry {
  id: string;
  category: 'Connection' | 'Touch' | 'Positions';
  name: string;
  about: string;
  steps?: string[]; // role tokens, see fillRoles: {F}/{B} subject, {f}/{b} object, {F's}/{B's} possessive
  tips: string[];
  works?: string;
  effort: Effort;
  pose?: PoseId;
  tags: string[];
}

/** MET by effort (Compendium of Physical Activities: sexual activity, light/moderate/active). */
export const EFFORT_MET: Record<Effort, number> = { light: 1.3, moderate: 1.8, active: 2.8 };

export const CATALOGUE: CatalogueEntry[] = [
  { id: 'cuddle', category: 'Connection', name: 'Cuddling', about: 'Unhurried closeness with no goal. Good for winding down together.', tips: ['Phones away', 'Try a few minutes of synced breathing'], effort: 'light', tags: ['Low effort', 'Any day'] },
  { id: 'massage', category: 'Connection', name: 'Massage', about: 'Taking turns giving a slow back, shoulder or full-body massage.', tips: ['Warm the oil in your hands first', 'Ask for more or less pressure', 'Great after leg day'], works: 'Hands and forearms (giver)', effort: 'light', tags: ['Recovery day', 'Relaxing'] },
  { id: 'kissing', category: 'Connection', name: 'Kissing', about: 'Slow kissing on its own, without moving on to anything else.', tips: ['Go slower than you think', 'Hands on the face or hair'], effort: 'light', tags: ['Any day'] },
  { id: 'shower', category: 'Connection', name: 'Shower or bath together', about: 'Washing each other, or just relaxing in the bath together.', tips: ['A non-slip mat makes it safer', 'Warm the bathroom first'], effort: 'light', tags: ['Relaxing'] },
  { id: 'manual', category: 'Touch', name: 'Using hands', about: 'Touching each other with the hands. Easy to adjust as you go.', tips: ['Lubricant helps a lot', 'Ask "like this?" and adjust', 'Short nails, clean hands'], effort: 'light', tags: ['Low effort'] },
  { id: 'oral', category: 'Touch', name: 'Oral sex', about: 'Using the mouth on a partner. Talk about what each of you likes and doesn\'t.', tips: ['Agree on a signal for "stop" or "slow down"', 'A pillow under the hips or knees helps comfort', 'Condoms or dental dams lower STI risk'], effort: 'light', tags: ['Talk first'] },
  { id: 'spoon', category: 'Positions', name: 'Spooning', about: 'Both lie on your sides facing the same way, one behind the other. Close, slow and easy on the joints.', steps: ['Both lie on your sides facing the same way, heads on the same pillow.', '{B} lies behind, chest to {F\'s} back, knees following the curve of {F\'s} legs.', '{B\'s} top arm rests over {F\'s} waist; the bottom arm goes under the pillow.', 'Shuffle until your hips line up and neither neck is bent.'], tips: ['A pillow between {F\'s} knees eases hips and lower back', 'Easy to talk and check in'], works: 'Core, glutes (light)', effort: 'light', pose: 'spoon', tags: ['Low effort', 'Back-friendly', 'Recovery day'] },
  { id: 'missionary', category: 'Positions', name: 'Face to face (lying)', about: 'One partner lies on their back, the other lies over them facing them, weight on their forearms or hands.', steps: ['{F} lies on {F\'s} back with knees bent and a pillow under the head.', '{B} kneels between {F\'s} legs, then lowers down, face to face.', '{B} takes {B\'s} weight on forearms or hands, not on {f}.', 'Adjust the angle with a pillow under {F\'s} hips.'], tips: ['Good for eye contact and talking', 'Rest on forearms to save the wrists'], works: 'Chest, shoulders, core (above); glutes (below)', effort: 'moderate', pose: 'missionary', tags: ['Classic'] },
  { id: 'on-top', category: 'Positions', name: 'On top', about: 'One partner lies on their back while the other kneels astride, upright or leaning forward, and controls the pace.', steps: ['{F} lies on {F\'s} back, legs straight or slightly bent.', '{B} kneels astride {F\'s} hips, knees on the bed either side.', '{B} sits upright or leans forward with hands on {F\'s} chest or the bed.', '{B} sets the pace; {F} can support {B\'s} hips.'], tips: ['A pillow under each knee for whoever is on top', 'Leaning forward is easier on the thighs'], works: 'Thighs, glutes, core (on top)', effort: 'active', pose: 'on-top', tags: ['Leg workout', 'You set the pace'] },
  { id: 'behind', category: 'Positions', name: 'From behind (kneeling)', about: 'One partner is on hands and knees (or forearms), the other kneels behind them.', steps: ['{F} goes on to hands and knees on the bed, forearms down if the wrists tire.', '{B} kneels upright behind {f}, knees between or outside {F\'s}.', '{B\'s} hands rest on {F\'s} hips for balance.', 'Match heights with a pillow under {F\'s} knees, or by {b} widening {B\'s} stance.'], tips: ['Check in more often, as you can\'t see each other\'s faces', 'Soft surface for both sets of knees'], works: 'Glutes, thighs, core', effort: 'active', pose: 'behind', tags: ['Active'] },
  { id: 'side-face', category: 'Positions', name: 'Side by side, facing', about: 'Both lie on your sides facing each other, legs tangled. Very low effort and close.', tips: ['Top leg over your partner\'s hip', 'Good when one of you is tired or sore'], works: 'Core (light)', effort: 'light', tags: ['Low effort', 'Back-friendly'] },
  { id: 'seated', category: 'Positions', name: 'Seated (lap)', about: 'One partner sits on the bed or a sturdy chair, the other sits on their lap facing them.', tips: ['Use a chair without arms, or the edge of the bed', 'Wrap arms around each other for balance'], works: 'Thighs, core', effort: 'moderate', tags: ['Close'] },
];

export const WISH_ITEMS: { id: string; text: string }[] = [
  { id: 'massage-night', text: 'A massage night' },
  { id: 'new-position', text: 'Try something new from the catalogue' },
  { id: 'morning', text: 'Mornings' },
  { id: 'shower', text: 'Shower or bath together' },
  { id: 'slow-night', text: 'A slow night with no rush' },
  { id: 'candles-music', text: 'Candles and music' },
  { id: 'lingerie', text: 'Dressing up or lingerie' },
  { id: 'toys', text: 'Using a toy together' },
  { id: 'roleplay', text: 'Role play' },
  { id: 'away', text: 'A night away somewhere' },
  { id: 'date-then-home', text: 'Date night out, then home' },
  { id: 'more-often', text: 'More often' },
];

/** Items both said yes or maybe to. Answers are only compared on the phone. */
export function matches(mine: { itemId: string; answer: string }[], theirs: { itemId: string; answer: string }[]): string[] {
  const ok = (a?: string) => a === 'yes' || a === 'maybe';
  return WISH_ITEMS.map((w) => w.id).filter((id) => ok(mine.find((m) => m.itemId === id)?.answer) && ok(theirs.find((t) => t.itemId === id)?.answer));
}

/**
 * Fill role tokens with pronouns for whoever is in each role.
 * {F}/{B} = subject (She/He, capitalised at the start of a sentence),
 * {f}/{b} = object (her/him), {F's}/{B's} = possessive (her/his).
 */
export function fillRoles(s: string, front: 'Her' | 'Him', back: 'Her' | 'Him'): string {
  const subj = (r: 'Her' | 'Him') => (r === 'Her' ? 'she' : 'he');
  const obj = (r: 'Her' | 'Him') => (r === 'Her' ? 'her' : 'him');
  const poss = (r: 'Her' | 'Him') => (r === 'Her' ? 'her' : 'his');
  const out = s
    .replace(/\{F's\}/g, poss(front)).replace(/\{B's\}/g, poss(back))
    .replace(/\{F\}/g, subj(front)).replace(/\{B\}/g, subj(back))
    .replace(/\{f\}/g, obj(front)).replace(/\{b\}/g, obj(back));
  return out.replace(/(^|[.!?]\s+)([a-z])/g, (_, a: string, c: string) => a + c.toUpperCase());
}
