import type { SealId } from './signs.ts'

export type Element = 'fire' | 'water' | 'earth' | 'lightning' | 'summon' | 'seal' | 'clone'

export interface Jutsu {
  id: string
  name: string
  element: Element
  seals: SealId[]
  /** Who uses it in the series, or what it does. */
  note: string
}

/**
 * Seal orders as they appear in the series. Most come from the jutsu list in
 * Kazuhito Takahashi's NARUTO-HandSignDetection (MIT); Chidori and Summoning
 * follow the anime.
 */
export const JUTSU: Jutsu[] = [
  {
    id: 'clone',
    name: 'Clone Jutsu',
    element: 'clone',
    seals: ['ram', 'snake', 'tiger'],
    note: 'The academy basic Naruto could never pass.',
  },
  {
    id: 'chidori',
    name: 'Chidori',
    element: 'lightning',
    seals: ['ox', 'hare', 'monkey'],
    note: 'Kakashi’s lightning blade, later taught to Sasuke.',
  },
  {
    id: 'water-trumpet',
    name: 'Water Style: Water Trumpet',
    element: 'water',
    seals: ['dragon', 'tiger', 'hare'],
    note: 'A blast of water spat from the mouth.',
  },
  {
    id: 'dragon-flame',
    name: 'Fire Style: Dragon Flame',
    element: 'fire',
    seals: ['snake', 'dragon', 'hare', 'tiger'],
    note: 'Fire that races along a wire to its target.',
  },
  {
    id: 'fanged-pursuit',
    name: 'Summoning: Earth Style: Fanged Pursuit',
    element: 'earth',
    seals: ['tiger', 'snake', 'dragon', 'dog'],
    note: 'Kakashi’s ninja hounds burst from the ground.',
  },
  {
    id: 'summoning',
    name: 'Summoning Jutsu',
    element: 'summon',
    seals: ['boar', 'dog', 'bird', 'monkey', 'ram'],
    note: 'Calls a creature bound by a blood contract.',
  },
  {
    id: 'substitution',
    name: 'Substitution Jutsu',
    element: 'clone',
    seals: ['ram', 'boar', 'ox', 'dog', 'snake'],
    note: 'Swap your body for a log at the last moment.',
  },
  {
    id: 'impure-world',
    name: 'Impure World Reincarnation',
    element: 'seal',
    seals: ['tiger', 'snake', 'dog', 'dragon', 'clap'],
    note: 'The forbidden jutsu Orochimaru uses to bring back the dead.',
  },
  {
    id: 'fireball',
    name: 'Fire Style: Fireball',
    element: 'fire',
    seals: ['snake', 'ram', 'monkey', 'boar', 'horse', 'tiger'],
    note: 'The Uchiha rite of passage.',
  },
  {
    id: 'phoenix-flower',
    name: 'Fire Style: Phoenix Flower',
    element: 'fire',
    seals: ['rat', 'tiger', 'dog', 'ox', 'hare', 'tiger'],
    note: 'A volley of small fireballs, often hiding shuriken.',
  },
  {
    id: 'water-shark',
    name: 'Water Style: Water Shark Bomb',
    element: 'water',
    seals: ['tiger', 'ox', 'dragon', 'hare', 'bird', 'dragon', 'ram'],
    note: 'Kisame’s shark of water.',
  },
  {
    id: 'dragon-flame-bomb',
    name: 'Fire Style: Dragon Flame Bomb',
    element: 'fire',
    seals: ['ram', 'horse', 'snake', 'dragon', 'rat', 'ox', 'tiger'],
    note: 'A dragon made of fire.',
  },
  {
    id: 'reaper-death-seal',
    name: 'Reaper Death Seal',
    element: 'seal',
    seals: ['snake', 'boar', 'ram', 'hare', 'dog', 'rat', 'bird', 'horse', 'snake', 'clap'],
    note: 'The Third Hokage’s last jutsu. It costs the user’s life.',
  },
]
