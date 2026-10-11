// Composes the city: WebGL scene + DOM HUD overlays.
import { lazy, Suspense, useEffect } from 'react'
import { hasWebGL } from '../city2d/webgl'
import { CityCanvas } from '../city3d/CityCanvas'
import { TopNav } from '../components/TopNav'
import { useGrid } from '../store/grid'
import { ApprovalDialog } from './ApprovalDialog'
import { BuildMenu } from './BuildMenu'
import { CommandBar } from './CommandBar'
import { SidePanel } from './SidePanel'

// Without WebGL, fall back to the older 2D DOM city (loaded only when needed).
const City2D = lazy(() => import('../city2d/City2D').then((m) => ({ default: m.City2D })))

export function CityPage() {
  const loadInitialLogs = useGrid((s) => s.loadInitialLogs)
  useEffect(() => {
    if (useGrid.getState().logs.length === 0) void loadInitialLogs()
  }, [loadInitialLogs])

  return (
    <div className="relative h-full w-full overflow-hidden bg-gg-void">
      {hasWebGL() ? (
        <CityCanvas />
      ) : (
        <Suspense fallback={null}>
          <City2D />
        </Suspense>
      )}
      <TopNav />
      <BuildMenu />
      <CommandBar />
      <SidePanel />
      <ApprovalDialog />
    </div>
  )
}
