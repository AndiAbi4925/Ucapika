const test = require("node:test");
const assert = require("node:assert/strict");
const { createGlobeDoubleTap } = require("../../src/helpers/globeDoubleTap");

test("two quick Fn releases toggle once", () => {
  const gesture = createGlobeDoubleTap();
  gesture.down(0);
  assert.equal(gesture.up(70), false);
  gesture.down(170);
  assert.equal(gesture.up(250), true);
  gesture.down(325);
  assert.equal(gesture.up(400), false);
});

test("a hold, a late tap, and an interrupted tap do not toggle", () => {
  const gesture = createGlobeDoubleTap();
  gesture.down(0);
  assert.equal(gesture.up(300), false);
  gesture.down(350);
  assert.equal(gesture.up(400), false);
  gesture.down(900);
  assert.equal(gesture.up(960), false);
  gesture.down(1010);
  gesture.reset();
  assert.equal(gesture.up(1060), false);
});
