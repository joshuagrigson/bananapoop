import test from 'node:test';
import assert from 'node:assert/strict';
import { folkSvg, FOLK } from '../art/folk-kit/folkSvg.js';
import { mapSvg, MAPS } from '../art/folk-kit/mapSvg.js';

test('all worlds and species produce finite, seamless animated poses', () => {
  for (const world of Object.keys(FOLK.worlds)) for (const species of FOLK.species) {
    for (const pose of ['idle', 'walk', 'carry', 'type', 'phone', 'cheer']) {
      const look = {world, species, tier: 4};
      const draw = phase => folkSvg(look, {id:'test', pose, phase});
      assert.equal(draw(0), draw(1), `${world}/${species}/${pose} wraps without a jump`);
      assert.notEqual(draw(0), draw(0.25));
      for (const phase of [0, 0.25, 0.5, 0.75]) assert.doesNotMatch(draw(phase), /NaN|Infinity|undefined/);
    }
  }
});
test('maps preserve room navigation and include motion accessibility for every theme', () => {
  for (const world of MAPS.worlds) {
    const svg = mapSvg(world, {rooms: [{id:'room-a', name:'A & B', accent:'#60a5fa'}]});
    assert.match(svg, /data-sel="room-a"/);
    assert.match(svg, /A &amp; B/);
    assert.match(svg, /prefers-reduced-motion:reduce/);
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  }
});
