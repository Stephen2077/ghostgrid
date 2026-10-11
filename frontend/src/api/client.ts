// Single entry point for all backend calls. UI and stores call `api.*`, never mock.ts directly.
// Backend team: replace the bodies below with real fetch() calls. Each call already knows
// which provider key / base URL / model the building is configured to use (getApiConfig).
import { BUILDINGS } from '../constants'
import { resolveBuildingKey, useKeys } from '../store/keys'
import type { BuildingId, PlaygroundParams, Provider, ProviderKey, RequestLog } from '../types'
import * as mock from './mock'

export interface ApiConfig {
  provider: Provider | null
  baseUrl: string | null
  apiKey: string | null
  model: string
}

export function getApiConfig(buildingId: BuildingId): ApiConfig {
  const state = useKeys.getState()
  const key = resolveBuildingKey(state, buildingId)
  return {
    provider: key?.provider ?? null,
    baseUrl: key?.baseUrl ?? null,
    apiKey: key?.key ?? null,
    model: state.buildingConfig[buildingId]?.model ?? BUILDINGS[buildingId]?.model ?? 'custom-model',
  }
}

// Adds a row to Request Logs so the console mirrors what happened in the city.
function record(agentId: BuildingId, method: RequestLog['method'], path: string, status: number, started: number, request: unknown, response: unknown, tokensIn = 0, tokensOut = 0) {
  mock.recordRequest({
    id: mock.uid('req'),
    ts: Date.now(),
    agentId,
    method,
    path,
    status,
    latencyMs: Date.now() - started,
    tokensIn,
    tokensOut,
    request,
    response,
  })
}

export const api = {
  async submitCommand(command: string) {
    const started = Date.now()
    const cfg = getApiConfig('router')
    const res = await mock.submitCommand(command)
    record('router', 'POST', '/v1/tasks', 201, started, { command, model: cfg.model }, res, Math.ceil(command.length / 4), 120)
    return res
  },
  async approve(taskId: string) {
    const started = Date.now()
    const res = await mock.approve(taskId)
    record('security', 'POST', `/v1/approvals/${taskId}/approve`, 200, started, { taskId }, res, 300, res.tokens)
    return res
  },
  async reject(taskId: string) {
    const started = Date.now()
    const res = await mock.reject(taskId)
    record('security', 'POST', `/v1/approvals/${taskId}/reject`, 200, started, { taskId }, res)
    return res
  },
  getLogs: mock.getLogs,
  listAgents: mock.listAgents,
  listRequests: mock.listRequests,
  getUsage: mock.getUsage,
  listPlatformKeys: mock.listPlatformKeys,
  createPlatformKey: mock.createPlatformKey,
  revokePlatformKey: mock.revokePlatformKey,
  testConnection: (key: Pick<ProviderKey, 'provider' | 'baseUrl' | 'key'>) => mock.testConnection(key),
  async runPlayground(agentId: BuildingId, prompt: string, params: PlaygroundParams, onToken: (chunk: string) => void, signal?: AbortSignal) {
    const started = Date.now()
    const cfg = getApiConfig(agentId)
    const res = await mock.runPlayground(agentId, prompt, params, onToken, signal)
    record(agentId, 'POST', `/v1/agents/${agentId}/run`, 200, started, { model: cfg.model, input: prompt, ...params }, { output: res.text }, res.tokensIn, res.tokensOut)
    return res
  },
}
