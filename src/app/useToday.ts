import { useEffect, useState } from 'react'
import { addDays, localDateTimeToMs, todayIso, type IsoDate } from '../domain/dates.ts'

/** Today's date. Changes at local midnight and when the app comes back from the background. */
export function useToday(): IsoDate {
  const [today, setToday] = useState(() => todayIso())

  useEffect(() => {
    const refresh = () => setToday(todayIso())
    const timer = setTimeout(refresh, localDateTimeToMs(addDays(today, 1), '00:00') - Date.now() + 1000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [today])

  return today
}
