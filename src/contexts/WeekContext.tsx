import { createContext, useContext, useState, ReactNode } from 'react'
import { getWeekStart } from '../lib/dateUtils'

interface WeekCtx { weekStart: Date; setWeekStart: (d: Date) => void }
const Ctx = createContext<WeekCtx>(null!)
export const useWeek = () => useContext(Ctx)

export function WeekProvider({ children }: { children: ReactNode }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  return <Ctx.Provider value={{ weekStart, setWeekStart }}>{children}</Ctx.Provider>
}
