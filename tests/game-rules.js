/* Focused rules checks for the digital adaptation of the base game. */
const assert = require('node:assert/strict');
require('../js/cards.js');
require('../js/game.js');
const { cards: C, OinkGame } = globalThis.OINK;

const deck = C.buildDeck();
assert.equal(deck.length, 112);
assert.equal(deck.filter(c => c.kind === 'number').length, 64);
for (const color of C.COLORS) {
  for (let value = 0; value <= 7; value++) {
    assert.equal(deck.filter(c => c.kind === 'number' && c.color === color && c.value === value).length, 2);
  }
  for (const effect of Object.keys(C.EFFECTS)) {
    assert.equal(deck.filter(c => c.kind === 'action' && c.color === color && c.effect === effect).length, 2);
  }
}
assert.equal(deck.filter(c => c.kind === 'wild').length, 8);

const number = (id, color, value) => ({ id, kind: 'number', color, value });
const action = (id, color, effect) => ({ id, kind: 'action', color, effect });
function game(count = 3, now = () => 0) {
  return new OinkGame({ players: Array.from({ length: count }, (_, i) => ({ name: String(i), isBot: true })), now });
}

{
  const g = game();
  assert.deepEqual(g.players.map(p => p.hand.length), [8, 8, 8]);
}

{
  const g = game(3);
  g.discard = [number('top', 'red', 1)];
  g.activeColor = 'red';
  g.players[0].hand = [action('attack1', 'red', 'draw3'), number('filler0', 'blue', 2)];
  g.players[1].hand = [action('attack2', 'green', 'draw3'), number('filler1', 'blue', 3)];
  g.playCard(0, 'attack1');
  assert.equal(g.pendingDraw, 3);
  assert.equal(g.turn, 1);
  assert.equal(g.canPlayCard(g.players[1].hand[1]), false);
  g.playCard(1, 'attack2');
  assert.equal(g.pendingDraw, 6);
  assert.equal(g.turn, 2);
  const before = g.players[2].hand.length;
  g.drawCard(2);
  assert.equal(g.players[2].hand.length, before + 6);
  assert.equal(g.pendingDraw, 0);
  assert.equal(g.turn, 0);
}

{
  const g = game(2);
  g.discard = [number('top', 'orange', 1)];
  g.activeColor = 'orange';
  g.players[0].hand = [action('turn', 'orange', 'reverse'), number('filler', 'red', 2)];
  g.playCard(0, 'turn');
  assert.equal(g.direction, -1);
  assert.equal(g.turn, 1); // a direction change is not a skip in two-player Svintus
}

{
  const g = game(3);
  g.discard = [number('top', 'red', 1)];
  g.activeColor = 'red';
  g.players[0].hand = [number('first', 'red', 5), number('filler', 'orange', 3)];
  g.players[2].hand = [number('copy', 'red', 5), number('filler2', 'green', 4)];
  g.playCard(0, 'first');
  assert.equal(g.turn, 1);
  assert.equal(g.canIntercept(2, g.players[2].hand[0]), true);
  g.interceptCard(2, 'copy');
  assert.equal(g.turn, 0);
  assert.equal(g.discard[g.discard.length - 1].id, 'copy');
}

{
  const g = game(2);
  g.discard = [number('top', 'blue', 1)];
  g.activeColor = 'blue';
  g.players[0].hand = [action('slap', 'blue', 'slap'), number('filler', 'red', 2)];
  g.playCard(0, 'slap');
  assert.equal(g.phase, 'slap');
  const before = g.players[1].hand.length;
  const result = g.resolveSlap(['slap', 'grab']);
  assert.deepEqual(result.losers, [1]);
  assert.equal(g.players[1].hand.length, before + 2);
  assert.equal(g.turn, 1);
}

{
  const g = game(3);
  g.discard = [number('top', 'blue', 1)];
  g.activeColor = 'blue';
  g.players[0].hand = [action('slap', 'blue', 'slap'), number('filler', 'red', 2)];
  g.playCard(0, 'slap');
  const before = g.players.map(p => p.hand.length);
  assert.throws(() => g.resolveSlap(['slap', 'oops', 'grab']), /valid choice/);
  assert.equal(g.phase, 'slap');
  const result = g.resolveSlap(['dodge', 'slap', 'slap']);
  assert.deepEqual(result.losers, [1, 2]);
  assert.deepEqual(g.players.map(p => p.hand.length), [before[0], before[1] + 2, before[2] + 2]);
}

{
  const g = game(3);
  g.discard = [number('top', 'blue', 1)];
  g.activeColor = 'blue';
  g.players[0].hand = [action('slap', 'blue', 'slap'), number('filler', 'red', 2)];
  g.playCard(0, 'slap');
  const before = g.players.map(p => p.hand.length);
  assert.deepEqual(g.resolveSlap(['slap', 'dodge', 'grab']).losers, []);
  assert.deepEqual(g.players.map(p => p.hand.length), before);
}

{
  const g = game(2);
  g.discard = [number('top', 'blue', 1)];
  g.activeColor = 'blue';
  g.players[0].hand = [action('slap', 'blue', 'slap'), number('filler', 'red', 2)];
  g.playCard(0, 'slap');
  assert.deepEqual(g.resolveSlap(['grab', 'dodge']).losers, [1]);
}

{
  const g = game(2);
  g.discard = [number('top', 'blue', 1)];
  g.activeColor = 'blue';
  g.players[0].hand = [action('slap', 'blue', 'slap'), number('filler', 'red', 2)];
  g.playCard(0, 'slap');
  assert.deepEqual(g.resolveSlap(['grab', 'grab']).losers, []);
}

{
  const g = game(2);
  g.discard = [number('top', 'green', 1)];
  g.activeColor = 'green';
  g.players[1].hand = [action('hush', 'green', 'hush'), number('filler', 'red', 2)];
  g.turn = 1;
  g.playCard(1, 'hush');
  assert.equal(g.phase, 'hush');
  const before = g.players[0].hand.length;
  g.resolveHush(true);
  assert.equal(g.players[0].hand.length, before + 2);
  assert.equal(g.turn, 0);
}

{
  const g = game(3);
  g.discard = [number('top', 'blue', 1)];
  g.activeColor = 'blue';
  g.players[0].hand = [action('hush', 'blue', 'hush'), number('filler', 'red', 2)];
  g.playCard(0, 'hush');
  const before = g.players[2].hand.length;
  g.resolveHush(2);
  assert.equal(g.players[2].hand.length, before + 2);
}

{
  let clock = 0;
  const g = game(2, () => clock);
  g.discard = [number('top', 'red', 1)];
  g.activeColor = 'red';
  g.players[0].hand = [number('play', 'red', 3), number('last', 'blue', 2)];
  assert.equal(g.callOink(0), true);
  g.playCard(0, 'play');
  assert.equal(g.oink, null);
  g.turn = 0;
  g.players[0].hand = [number('play2', 'red', 4), number('last2', 'blue', 2)];
  g.playCard(0, 'play2');
  assert.equal(g.oink.player, 0);
  clock = 3001;
  g.oinkTick();
  assert.equal(g.players[0].hand.length, 4);
}

console.log('Focused game rules passed.');
