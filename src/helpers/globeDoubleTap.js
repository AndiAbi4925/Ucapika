const MAX_PRESS_MS = 240;
const MAX_GAP_MS = 420;

function createGlobeDoubleTap() {
  let downAt = null;
  let firstRelease = null;

  function reset() {
    downAt = null;
    firstRelease = null;
  }

  return {
    down(now) {
      if (downAt === null) downAt = now;
    },
    up(now) {
      const start = downAt;
      downAt = null;
      if (start === null || now < start || now - start > MAX_PRESS_MS) {
        reset();
        return false;
      }
      if (firstRelease !== null && start >= firstRelease && start - firstRelease <= MAX_GAP_MS) {
        reset();
        return true;
      }
      firstRelease = now;
      return false;
    },
    reset,
  };
}

module.exports = { createGlobeDoubleTap };
