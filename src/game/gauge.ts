import { abilityOf } from './abilities';
import { gaugeMon, type SpeciesDef } from './data';

// gimmick counters only: hazard immunity, wall heal, Reflect break
export const counterAbility = (def: SpeciesDef) => { const a = abilityOf(def); return !!a && (!!a.hazards?.length || !!a.wall || !!a.reflect); };
export const gaugeCounter = (def: SpeciesDef) => gaugeMon(def) && counterAbility(def);
// a gauge mon's counter switches on only for its own gold-band release
export const counterLive = (def: SpeciesDef, goldShooter: boolean) => !gaugeCounter(def) || goldShooter;
// stop 1's gentle opener: gold still aims full power, no bonus while the player learns the meter
export const quietOpener = (stop: number, gentle: boolean) => stop === 0 && gentle;
export const GAUGE_ICON = 'quick-claw';
