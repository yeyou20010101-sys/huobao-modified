/**
 * Agent 聊天路由 — 非流式版本
 */
import { Hono } from 'hono'
import { createAgent, resolveAgentBillingTarget, validAgentTypes } from '../agents/index.js'
import { explainTextApiConnectError, getTextConfig, getTextProviderBaseUrl } from '../services/ai.js'
import { success, badRequest, notFound, taskError } from '../utils/response.js'
import { logTaskError, logTaskPayload, logTaskProgress, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'
import { requireUser } from '../middleware/auth.js'
import { getWritableDrama, getWritableEpisode } from '../utils/ownership.js'
import { beginTask, refundTask, settleTask } from '../services/billing.js'
import { randomUUID } from 'crypto'

const app = new Hono()

function normalizeToolName(entry: any) {
  return entry?.toolName
    || entry?.tool?.toolName
    || entry?.tool?.id
    || entry?.name
    || entry?.type
    || null
}

function normalizeToolResult(entry: any) {
  const result = entry?.result ?? entry?.output ?? entry?.data ?? null
  return typeof result === 'string' ? result : JSON.stringify(result)
}

// POST /agent/:type/chat — 非流式 Agent 对话
app.post('/:type/chat', async (c) => {
  const user = requireUser(c)
  const agentType = c.req.param('type')
  if (!validAgentTypes.includes(agentType)) {
    return badRequest(c, `Invalid agent type: ${agentType}`)
  }

  const body = await c.req.json()
  const { message, drama_id, episode_id } = body

  logTaskStart('Agent', agentType, {
    dramaId: drama_id,
    episodeId: episode_id,
    message,
  })
  logTaskPayload('Agent', `${agentType} input`, body)

  if (!episode_id || !drama_id) {
    logTaskError('Agent', agentType, { reason: 'missing drama_id or episode_id' })
    return badRequest(c, 'drama_id and episode_id are required')
  }
  if (!getWritableDrama(Number(drama_id), user.id) || !getWritableEpisode(Number(episode_id), user.id)) {
    return notFound(c)
  }

  const agent = createAgent(agentType, episode_id, drama_id, user.id)
  if (!agent) {
    logTaskError('Agent', agentType, { reason: 'agent not found' })
    return badRequest(c, 'Agent not found')
  }

  let hold
  try {
    const billingTarget = resolveAgentBillingTarget(agentType, user.id)
    hold = beginTask({
      userId: user.id,
      taskType: 'agent',
      provider: billingTarget.provider,
      model: billingTarget.model,
      dramaId: Number(drama_id),
      episodeId: Number(episode_id),
      idempotencyKey: `agent:${randomUUID()}`,
    })
  } catch (err) {
    return taskError(c, err)
  }

  const startTime = performance.now()

  try {
    const result = await agent.generate(
      [{ role: 'user', content: message }],
      { maxSteps: 20 },
    )

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
    logTaskSuccess('Agent', agentType, { elapsedSeconds: elapsed })

    // 收集所有 tool calls 和 results
    const toolCalls = result.toolCalls || []
    const toolResults = result.toolResults || []
    const normalizedToolCalls = toolCalls.map((tc: any) => ({
      toolName: normalizeToolName(tc),
      args: tc?.args ?? tc?.input ?? null,
    }))
    const normalizedToolResults = toolResults.map((tr: any) => ({
      toolName: normalizeToolName(tr),
      result: normalizeToolResult(tr),
    }))

    logTaskProgress('Agent', 'tool-summary', {
      agentType,
      toolCalls: normalizedToolCalls.map((tc: any) => tc.toolName),
      toolResults: normalizedToolResults.map((tr: any) => tr.toolName),
    })
    logTaskPayload('Agent', `${agentType} tool-results`, normalizedToolResults)

    settleTask(hold.id)
    return success(c, {
      type: 'done',
      text: result.text || '',
      toolCalls: normalizedToolCalls,
      toolResults: normalizedToolResults,
    })
  } catch (err: any) {
    refundTask(hold.id, err?.message || 'Agent execution failed')
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
    let message = err?.message || 'Agent execution failed'
    try {
      const textConfig = getTextConfig(user.id)
      const baseUrl = getTextProviderBaseUrl(textConfig)
      message = explainTextApiConnectError(err, baseUrl).message
    } catch {
      /* keep original message if config itself is broken */
    }
    logTaskError('Agent', agentType, { elapsedSeconds: elapsed, error: message })
    console.error(err.stack || err)
    return badRequest(c, message)
  }
})

// GET /agent/:type/debug
app.get('/:type/debug', async (c) => {
  const agentType = c.req.param('type')
  if (!validAgentTypes.includes(agentType)) return badRequest(c, 'Invalid agent type')
  return success(c, { agent_type: agentType, valid: true })
})

export default app
