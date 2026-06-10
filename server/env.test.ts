import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEnvValue, readApiEnv } from './env.ts'

describe('normalizeEnvValue', () => {
  it('trims whitespace and surrounding quotes', () => {
    assert.equal(normalizeEnvValue('  "sk-ant-test"  '), 'sk-ant-test')
    assert.equal(normalizeEnvValue("'sk-ant-test'"), 'sk-ant-test')
  })

  it('removes a UTF-8 BOM prefix', () => {
    assert.equal(normalizeEnvValue('\uFEFFsk-ant-test'), 'sk-ant-test')
  })
})

describe('readApiEnv', () => {
  it('prefers ANTHROPIC_API_KEY over VITE_ANTHROPIC_API_KEY', () => {
    process.env.ANTHROPIC_API_KEY = 'primary-key'
    process.env.VITE_ANTHROPIC_API_KEY = 'fallback-key'

    assert.equal(readApiEnv().anthropicApiKey, 'primary-key')

    delete process.env.ANTHROPIC_API_KEY
    assert.equal(readApiEnv().anthropicApiKey, 'fallback-key')

    delete process.env.VITE_ANTHROPIC_API_KEY
  })
})
