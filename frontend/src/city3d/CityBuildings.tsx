// Renders every building in the store with its type-specific art inside a BuildingShell.
import type { ComponentType } from 'react'
import { useBuildingList } from '../store/grid'
import type { BuildingType } from '../types'
import { BotBuilding } from './buildings/BotBuilding'
import { ClaudeNexus } from './buildings/ClaudeNexus'
import { CodexTower } from './buildings/CodexTower'
import { DeepSeekForge } from './buildings/DeepSeekForge'
import { RouterSpire } from './buildings/RouterSpire'
import { SecurityCheckpoint } from './buildings/SecurityCheckpoint'
import { BuildingShell } from './BuildingShell'

const ART: Record<BuildingType, ComponentType> = {
  router: RouterSpire,
  codex: CodexTower,
  claude: ClaudeNexus,
  deepseek: DeepSeekForge,
  security: SecurityCheckpoint,
  bot: BotBuilding,
}

export function CityBuildings() {
  const list = useBuildingList()
  return (
    <>
      {list.map((b) => {
        const Art = ART[b.type]
        return (
          <BuildingShell key={b.id} building={b}>
            <Art />
          </BuildingShell>
        )
      })}
    </>
  )
}
