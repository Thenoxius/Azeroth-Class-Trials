// What a new visitor needs to choose: a concrete description and the roles this game lets
// you play.

export const CLASS_INTRO = {
  hunter: {
    summary: 'Fights from range with a bow or gun while a pet holds the enemy’s attention.',
    feel: 'You keep your distance, send your pet in and choose your shots.',
    roles: ['Ranged damage'],
  },
  mage: {
    summary: 'Casts fire, frost and arcane spells from range, and can freeze or polymorph enemies.',
    feel: 'You stand still to cast big spells, and step away when something reaches you.',
    roles: ['Ranged spell damage'],
  },
  priest: {
    summary: 'Heals and shields allies, or deals shadow damage over time.',
    feel: 'You watch health bars and react, or stack up damage that keeps ticking.',
    roles: ['Healing', 'Shadow damage'],
  },
  warrior: {
    summary: 'Fights up close in heavy armor, and builds rage by hitting and being hit.',
    feel: 'You charge in, and spend rage on the right strike at the right moment.',
    roles: ['Tank', 'Melee damage'],
  },
  rogue: {
    summary: 'Fights up close with fast blades, using stealth, poisons and combo points.',
    feel: 'You build combo points on your target, then spend them on a finishing move.',
    roles: ['Melee damage'],
  },
  shaman: {
    summary: 'Mixes lightning, weapon strikes and healing, and places totems that help nearby allies.',
    feel: 'You choose a role per spec, and put your totems where they are useful.',
    roles: ['Healing', 'Spell damage', 'Melee damage'],
  },
};
