import assert from 'node:assert/strict'
import test from 'node:test'

test('shouldCelebrateWinMilestone only triggers on new century win totals', async () => {
  const { isWinCenturyMilestone, shouldCelebrateWinMilestone } = await import('../src/winMilestoneUtils.ts')

  assert.equal(isWinCenturyMilestone(99), false)
  assert.equal(isWinCenturyMilestone(100), true)
  assert.equal(isWinCenturyMilestone(200), true)

  assert.equal(shouldCelebrateWinMilestone(100, 0), true)
  assert.equal(shouldCelebrateWinMilestone(100, 100), false)
  assert.equal(shouldCelebrateWinMilestone(200, 100), true)
  assert.equal(shouldCelebrateWinMilestone(250, 200), false)
})
