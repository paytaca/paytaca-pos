let nextPaymentId = 0

// Use a local attempt ID so overlapping taps can be distinguished without
// logging card identifiers, credentials, or payment payloads.
export function createCardPaymentTiming() {
  const attemptId = `card-${++nextPaymentId}`
  const startedAt = performance.now()
  const stages = {}
  let finished = false
  const round = value => Math.round(value * 10) / 10

  console.info('[CardPaymentTiming]', { attemptId, event: 'started' })

  return {
    async stage(name, operation) {
      const stageStartedAt = performance.now()
      let outcome = 'failed'
      try {
        const result = await operation()
        outcome = 'completed'
        return result
      } finally {
        const durationMs = round(performance.now() - stageStartedAt)
        stages[name] = (stages[name] || 0) + durationMs
        console.info('[CardPaymentTiming]', {
          attemptId, event: 'stage', stage: name, outcome, durationMs,
        })
      }
    },
    finish(outcome) {
      if (finished) return
      finished = true
      console.info('[CardPaymentTiming]', {
        attemptId,
        event: 'finished',
        outcome,
        totalMs: round(performance.now() - startedAt),
        stagesMs: { ...stages },
      })
    },
  }
}
