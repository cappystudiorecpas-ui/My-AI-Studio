import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  parseSpeedMultiplier, 
  buildAtempoFilter, 
  getSpeedOption, 
  SPEAKING_SPEED_OPTIONS, 
  DEFAULT_SPEED_ID 
} from '../src/utils/speed';

test('Speaking Speed - Option Definitions', () => {
  assert.equal(SPEAKING_SPEED_OPTIONS.length, 9, 'Must have exactly 9 speed options');
  assert.equal(DEFAULT_SPEED_ID, '1.00x', 'Default speed must be 1.00x');

  const speeds = SPEAKING_SPEED_OPTIONS.map((o) => o.speed);
  assert.deepEqual(speeds, [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 3.0]);
});

test('Speaking Speed - parseSpeedMultiplier', () => {
  assert.equal(parseSpeedMultiplier('0.75x'), 0.75);
  assert.equal(parseSpeedMultiplier('1.00x'), 1.0);
  assert.equal(parseSpeedMultiplier('1.25x'), 1.25);
  assert.equal(parseSpeedMultiplier('1.50x'), 1.5);
  assert.equal(parseSpeedMultiplier('1.75x'), 1.75);
  assert.equal(parseSpeedMultiplier('2.00x'), 2.0);
  assert.equal(parseSpeedMultiplier('2.25x'), 2.25);
  assert.equal(parseSpeedMultiplier('2.50x'), 2.5);
  assert.equal(parseSpeedMultiplier('3.00x'), 3.0);

  // Legacy percentage support
  assert.equal(parseSpeedMultiplier('+0%'), 1.0);
  assert.equal(parseSpeedMultiplier('+10%'), 1.1);
  assert.equal(parseSpeedMultiplier('-10%'), 0.9);

  // Defaults on empty / invalid
  assert.equal(parseSpeedMultiplier(undefined), 1.0);
  assert.equal(parseSpeedMultiplier(''), 1.0);
  assert.equal(parseSpeedMultiplier('invalid'), 1.0);
});

test('Speaking Speed - buildAtempoFilter chaining', () => {
  // 1.0x needs no filter
  assert.equal(buildAtempoFilter(1.0), '');

  // <= 2.0 uses single atempo
  assert.equal(buildAtempoFilter(0.75), 'atempo=0.75');
  assert.equal(buildAtempoFilter(1.25), 'atempo=1.25');
  assert.equal(buildAtempoFilter(1.5), 'atempo=1.5');
  assert.equal(buildAtempoFilter(1.75), 'atempo=1.75');
  assert.equal(buildAtempoFilter(2.0), 'atempo=2');

  // > 2.0 chains multiple atempo filters
  const filter225 = buildAtempoFilter(2.25);
  assert.equal(filter225, 'atempo=2.0,atempo=1.125');

  const filter250 = buildAtempoFilter(2.5);
  assert.equal(filter250, 'atempo=2.0,atempo=1.25');

  const filter300 = buildAtempoFilter(3.0);
  assert.equal(filter300, 'atempo=2.0,atempo=1.5');

  // Verify that every filter token is strictly between 0.5 and 2.0
  [0.75, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 3.0].forEach((speed) => {
    const filter = buildAtempoFilter(speed);
    const tokens = filter.split(',');
    let totalFactor = 1.0;
    for (const tok of tokens) {
      const match = tok.match(/^atempo=([0-9.]+)$/);
      assert.ok(match, `Invalid atempo token: ${tok}`);
      const val = parseFloat(match[1]);
      assert.ok(val >= 0.5 && val <= 2.0, `atempo value ${val} must be in [0.5, 2.0]`);
      totalFactor *= val;
    }
    assert.ok(
      Math.abs(totalFactor - speed) < 0.001,
      `Chained filters product ${totalFactor} must equal target speed ${speed}`
    );
  });
});

test('Speaking Speed - getSpeedOption lookup', () => {
  const opt3 = getSpeedOption('3.00x');
  assert.equal(opt3.id, '3.00x');
  assert.equal(opt3.speed, 3.0);
  assert.equal(opt3.burmeseName, 'တာဘို အမြန်ဆုံး');
  assert.equal(opt3.englishName, 'Turbo Speed');

  const optDefault = getSpeedOption('+0%');
  assert.equal(optDefault.id, '1.00x');
  assert.equal(optDefault.burmeseName, 'ပုံမှန်');
});
