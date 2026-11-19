function withProductCollectors(callback) {
  // These tests exercise the collectors with a mocked transport.
  const previous = process.env.UCAPIKA_ENABLE_TELEMETRY;
  process.env.UCAPIKA_ENABLE_TELEMETRY = "1";
  try {
    return callback();
  } finally {
    if (previous === undefined) delete process.env.UCAPIKA_ENABLE_TELEMETRY;
    else process.env.UCAPIKA_ENABLE_TELEMETRY = previous;
  }
}

module.exports = { withProductCollectors };
