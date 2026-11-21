import type { Exercise, MuscleGroup } from '../core/types';

/** Built-in library. Cues are short form reminders, not medical advice. */
export const EXERCISES: Exercise[] = [
  // chest
  { id: 'bench', name: 'Bench press', group: 'chest', also: ['arms', 'shoulders'], equipment: 'barbell', kind: 'weight', cues: ['Shoulder blades squeezed and down', 'Bar to lower chest, elbows about 45°', 'Feet planted, drive through the floor'] },
  { id: 'db-bench', name: 'Dumbbell bench press', group: 'chest', also: ['arms'], equipment: 'dumbbell', kind: 'weight', cues: ['Lower slowly to chest level', 'Press up and slightly in', 'Keep wrists stacked over elbows'] },
  { id: 'incline-db', name: 'Incline dumbbell press', group: 'chest', also: ['shoulders'], equipment: 'dumbbell', kind: 'weight', cues: ['Bench at 30–45°', 'Elbows under the dumbbells', 'Control the lowering'] },
  { id: 'pushup', name: 'Push-up', group: 'chest', also: ['arms', 'core'], equipment: 'bodyweight', kind: 'bodyweight', cues: ['Body in one straight line', 'Chest to just above the floor', 'Knees down to make it easier'] },
  { id: 'chest-fly', name: 'Cable chest fly', group: 'chest', equipment: 'cable', kind: 'weight', cues: ['Soft bend in the elbows', 'Hug a big tree', 'Squeeze at the middle'] },
  // back
  { id: 'deadlift', name: 'Deadlift', group: 'back', also: ['legs', 'glutes'], equipment: 'barbell', kind: 'weight', cues: ['Bar over mid-foot', 'Flat back, chest up', 'Push the floor away, hips and shoulders rise together'] },
  { id: 'row', name: 'Barbell row', group: 'back', also: ['arms'], equipment: 'barbell', kind: 'weight', cues: ['Hinge to about 45°', 'Pull to the belly button', 'Keep the back flat'] },
  { id: 'db-row', name: 'One-arm dumbbell row', group: 'back', also: ['arms'], equipment: 'dumbbell', kind: 'weight', cues: ['Hand and knee on the bench', 'Pull elbow to the hip', 'No twisting'] },
  { id: 'lat-pulldown', name: 'Lat pulldown', group: 'back', also: ['arms'], equipment: 'machine', kind: 'weight', cues: ['Lean back slightly', 'Pull bar to upper chest', 'Lead with the elbows'] },
  { id: 'pullup', name: 'Pull-up', group: 'back', also: ['arms'], equipment: 'bodyweight', kind: 'bodyweight', cues: ['Start from a dead hang', 'Chin over the bar', 'Use a band to assist'] },
  { id: 'band-row', name: 'Band row', group: 'back', equipment: 'band', kind: 'weight', cues: ['Anchor the band at chest height', 'Squeeze shoulder blades', 'Slow return'] },
  // shoulders
  { id: 'ohp', name: 'Overhead press', group: 'shoulders', also: ['arms'], equipment: 'barbell', kind: 'weight', cues: ['Squeeze glutes and brace', 'Bar path close to the face', 'Lock out overhead'] },
  { id: 'db-shoulder', name: 'Dumbbell shoulder press', group: 'shoulders', also: ['arms'], equipment: 'dumbbell', kind: 'weight', cues: ['Sit tall', 'Press up without arching', 'Lower to ear height'] },
  { id: 'lateral-raise', name: 'Lateral raise', group: 'shoulders', equipment: 'dumbbell', kind: 'weight', cues: ['Light weight, slow', 'Raise to shoulder height', 'Lead with the elbows'] },
  { id: 'face-pull', name: 'Face pull', group: 'shoulders', also: ['back'], equipment: 'cable', kind: 'weight', cues: ['Rope at face height', 'Pull apart to the ears', 'Elbows high'] },
  // arms
  { id: 'curl', name: 'Dumbbell curl', group: 'arms', equipment: 'dumbbell', kind: 'weight', cues: ['Elbows pinned to your sides', 'No swinging', 'Full stretch at the bottom'] },
  { id: 'hammer-curl', name: 'Hammer curl', group: 'arms', equipment: 'dumbbell', kind: 'weight', cues: ['Thumbs up grip', 'Slow on the way down'] },
  { id: 'triceps-pushdown', name: 'Triceps pushdown', group: 'arms', equipment: 'cable', kind: 'weight', cues: ['Elbows fixed at your sides', 'Straighten fully', 'Control the return'] },
  { id: 'dips', name: 'Bench dip', group: 'arms', also: ['chest'], equipment: 'bodyweight', kind: 'bodyweight', cues: ['Hands on a bench behind you', 'Lower until elbows reach 90°', 'Keep shoulders down'] },
  // legs
  { id: 'squat', name: 'Back squat', group: 'legs', also: ['glutes', 'core'], equipment: 'barbell', kind: 'weight', cues: ['Brace before you drop', 'Knees track over toes', 'Hips to at least knee height'] },
  { id: 'goblet-squat', name: 'Goblet squat', group: 'legs', also: ['glutes'], equipment: 'dumbbell', kind: 'weight', cues: ['Hold the weight at your chest', 'Sit between your heels', 'Chest up'] },
  { id: 'bw-squat', name: 'Bodyweight squat', group: 'legs', also: ['glutes'], equipment: 'bodyweight', kind: 'bodyweight', cues: ['Arms forward for balance', 'Sit back and down', 'Stand tall at the top'] },
  { id: 'leg-press', name: 'Leg press', group: 'legs', also: ['glutes'], equipment: 'machine', kind: 'weight', cues: ['Feet shoulder width', 'Lower until knees reach 90°', 'Don\'t lock the knees hard'] },
  { id: 'lunge', name: 'Walking lunge', group: 'legs', also: ['glutes'], equipment: 'dumbbell', kind: 'weight', cues: ['Long step', 'Back knee towards the floor', 'Front knee over the ankle'] },
  { id: 'rdl', name: 'Romanian deadlift', group: 'legs', also: ['glutes', 'back'], equipment: 'barbell', kind: 'weight', cues: ['Soft knees', 'Push hips back', 'Feel the hamstrings stretch'] },
  { id: 'calf-raise', name: 'Calf raise', group: 'legs', equipment: 'bodyweight', kind: 'bodyweight', cues: ['Rise on to the balls of your feet', 'Pause at the top', 'Slow down'] },
  // glutes
  { id: 'hip-thrust', name: 'Hip thrust', group: 'glutes', also: ['legs'], equipment: 'barbell', kind: 'weight', cues: ['Upper back on a bench', 'Chin tucked', 'Squeeze glutes hard at the top'] },
  { id: 'glute-bridge', name: 'Glute bridge', group: 'glutes', equipment: 'bodyweight', kind: 'bodyweight', cues: ['Lie on your back, knees bent', 'Drive through the heels', 'Pause at the top'] },
  { id: 'kickback', name: 'Cable kickback', group: 'glutes', equipment: 'cable', kind: 'weight', cues: ['Slight lean forward', 'Kick back and up', 'No arching'] },
  { id: 'kb-swing', name: 'Kettlebell swing', group: 'glutes', also: ['back', 'legs'], equipment: 'kettlebell', kind: 'weight', cues: ['It\'s a hinge, not a squat', 'Snap the hips forward', 'Arms just guide the bell'] },
  // core
  { id: 'plank', name: 'Plank', group: 'core', equipment: 'bodyweight', kind: 'time', cues: ['Elbows under shoulders', 'Squeeze glutes', 'Don\'t let the hips sag'] },
  { id: 'side-plank', name: 'Side plank', group: 'core', equipment: 'bodyweight', kind: 'time', cues: ['Hips high', 'Body in one line'] },
  { id: 'dead-bug', name: 'Dead bug', group: 'core', equipment: 'bodyweight', kind: 'bodyweight', cues: ['Lower back pressed to the floor', 'Opposite arm and leg', 'Move slowly'] },
  { id: 'crunch', name: 'Crunch', group: 'core', equipment: 'bodyweight', kind: 'bodyweight', cues: ['Chin off the chest', 'Curl, don\'t pull your neck'] },
  { id: 'russian-twist', name: 'Russian twist', group: 'core', equipment: 'bodyweight', kind: 'bodyweight', cues: ['Lean back slightly', 'Rotate from the ribs'] },
  { id: 'mountain-climber', name: 'Mountain climbers', group: 'core', also: ['legs'], equipment: 'bodyweight', kind: 'time', cues: ['Hands under shoulders', 'Drive knees to chest', 'Keep hips low'] },
];

export const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms', core: 'Core', legs: 'Legs', glutes: 'Glutes',
};

export function findExercise(id: string, custom: Exercise[] = []): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id) ?? custom.find((e) => e.id === id);
}
