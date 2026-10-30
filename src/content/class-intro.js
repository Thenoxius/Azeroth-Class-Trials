// What a new visitor needs to choose: a concrete description and the roles this game lets
// you play. practice is the class's one mechanic for the practice yard.
const castDone = (e) => e.type === 'castStop' && e.reason === 'complete' && !e.channel;

export const CLASS_INTRO = {
  hunter: {
    summary: 'Fights from range with a bow or gun while a pet holds the enemy’s attention.',
    feel: 'You keep your distance, send your pet in and choose your shots.',
    roles: ['Ranged damage'],
    practice: { text: 'Keep shooting: get Auto Shot going on the dummy', done: (e) => e.type === 'damage' && e.ability === 'autoshot' },
  },
  mage: {
    summary: 'Casts fire, frost and arcane spells from range, and can freeze or polymorph enemies.',
    feel: 'You stand still to cast big spells, and step away when something reaches you.',
    roles: ['Ranged spell damage'],
    practice: { text: 'Stand still and finish a spell with a cast time', done: castDone },
  },
  priest: {
    summary: 'Heals and shields allies, or deals shadow damage over time.',
    feel: 'You watch health bars and react, or stack up damage that keeps ticking.',
    roles: ['Healing', 'Shadow damage'],
    practice: {
      text: 'Protect yourself: cast a shield or heal',
      done: (e, ab) => e.type === 'cast' && ab && (ab.category === 'heal' || ab.category === 'defensive'),
    },
  },
  warrior: {
    summary: 'Fights up close in heavy armor, and builds rage by hitting and being hit.',
    feel: 'You charge in, and spend rage on the right strike at the right moment.',
    roles: ['Tank', 'Melee damage'],
    practice: { text: 'Build rage with your attacks, then spend it on an ability', done: (e, ab) => e.type === 'cast' && ab && ab.cost && ab.cost.rage },
  },
  rogue: {
    summary: 'Fights up close with fast blades, using stealth, poisons and combo points.',
    feel: 'You build combo points on your target, then spend them on a finishing move.',
    roles: ['Melee damage'],
    practice: { text: 'Build combo points on the dummy with a strike', done: (e, ab) => e.type === 'cast' && ab && ab.cost && ab.cost.energy },
  },
  shaman: {
    summary: 'Mixes lightning, weapon strikes and healing, and places totems that help nearby allies.',
    feel: 'You choose a role per spec, and put your totems where they are useful.',
    roles: ['Healing', 'Spell damage', 'Melee damage'],
    practice: { text: 'Place a totem', done: (e, ab) => e.type === 'cast' && ab && (ab.tags || []).includes('totem') },
  },
};
