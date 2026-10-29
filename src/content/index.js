// Content registry for the UI: class kits and trials in display order.
import { KIT as HUNTER } from './classes/hunter.js';
import { KIT as MAGE } from './classes/mage.js';
import { KIT as PRIEST } from './classes/priest.js';
import { KIT as WARRIOR } from './classes/warrior.js';
import { KIT as ROGUE } from './classes/rogue.js';
import { TRIAL as T1 } from './encounters/t1-questing.js';
import { TRIAL as T2 } from './encounters/t2-danger.js';
import { TRIAL as T3 } from './encounters/t3-dungeon.js';
import { TRIAL as T4 } from './encounters/t4-pvp.js';
import { TRIAL as T5 } from './encounters/t5-raid.js';

export const KITS = { hunter: HUNTER, mage: MAGE, priest: PRIEST, warrior: WARRIOR, rogue: ROGUE };
// The classes every trial, the analysis and the shared trial tests cover.
export const CLASS_ORDER = ['hunter', 'mage', 'priest', 'warrior', 'rogue'];
// Classes you can create a character for. Phase 4 classes join before every trial supports
// them; TRIAL_SUPPORT lists the trials they can already play.
export const PLAYABLE = ['hunter', 'mage', 'priest', 'warrior', 'rogue'];
const TRIAL_SUPPORT = {};
export const trialSupports = (trialId, classId) => !TRIAL_SUPPORT[classId] || TRIAL_SUPPORT[classId].includes(trialId);
export const TRIALS = [T1, T2, T3, T4, T5].sort((a, b) => a.order - b.order);
export const trialById = (id) => TRIALS.find((t) => t.id === id);
