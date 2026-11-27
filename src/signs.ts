/** The hand seals the detector knows, in the model's class order. */
export const SIGNS = [
  { id: 'rat', name: 'Rat', japanese: 'Ne' },
  { id: 'ox', name: 'Ox', japanese: 'Ushi' },
  { id: 'tiger', name: 'Tiger', japanese: 'Tora' },
  { id: 'hare', name: 'Hare', japanese: 'U' },
  { id: 'dragon', name: 'Dragon', japanese: 'Tatsu' },
  { id: 'snake', name: 'Snake', japanese: 'Mi' },
  { id: 'horse', name: 'Horse', japanese: 'Uma' },
  { id: 'ram', name: 'Ram', japanese: 'Hitsuji' },
  { id: 'monkey', name: 'Monkey', japanese: 'Saru' },
  { id: 'bird', name: 'Bird', japanese: 'Tori' },
  { id: 'dog', name: 'Dog', japanese: 'Inu' },
  { id: 'boar', name: 'Boar', japanese: 'I' },
  { id: 'clap', name: 'Clap', japanese: 'Gasshō' },
  // The model's "unknown" class: hands together, but no seal it recognises.
  { id: 'unknown', name: 'Unknown', japanese: '' },
  // The model also knows Mizunoe; the app ignores it, as it is hard to tell from Dog.
  { id: 'mizunoe', name: 'Mizunoe', japanese: 'Mizunoe' },
] as const

export type SignId = (typeof SIGNS)[number]['id']
export type Sign = (typeof SIGNS)[number]

/** Classes the app never counts as a seal. */
export type Ignored = 'unknown' | 'mizunoe'
const IGNORED = new Set<string>(['unknown', 'mizunoe'])

/** Seals a jutsu can use: every class the app does not ignore. */
export type SealId = Exclude<SignId, Ignored>

export function isSeal(id: SignId | null): id is SealId {
  return id !== null && !IGNORED.has(id)
}

const BY_ID = new Map<string, Sign>(SIGNS.map((s) => [s.id, s]))

export function sign(id: SignId): Sign {
  return BY_ID.get(id)!
}
