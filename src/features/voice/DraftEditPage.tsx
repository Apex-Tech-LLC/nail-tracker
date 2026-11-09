import { useEffect } from 'react'
import { paths, useAppLocation, useGoBack } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { DraftTurnForm } from '../turns/TurnForm.tsx'
import { learnFromFix } from './learnFromFix.ts'
import { sessionDate, updateVoiceSession, useVoiceSession } from './voiceSession.ts'

/** One draft turn in the usual Add turn form. Done hands the values back; nothing is saved. */
export function DraftEditPage({ cardKey }: { cardKey: string }) {
  const session = useVoiceSession()
  const goBack = useGoBack()
  const { locale } = useSettings()
  const [, navigate] = useAppLocation()
  const card = session.cards.find((item) => item.key === cardKey)

  // After a reload the drafts are gone: start again from Say.
  useEffect(() => {
    if (!card) navigate(session.made ? paths.sayCheck : paths.say, { replace: true })
  }, [card, session.made, navigate])

  if (!card) return null
  const date = sessionDate(session)
  const timeToFix = card.reader.checks.some((check) => check.code === 'timeNotRead' || check.code === 'timeGuessedHalf')
  const clientToFix = card.reader.checks.some((check) => check.code === 'requestConflict')

  return (
    <DraftTurnForm
      key={card.key}
      onClose={goBack}
      draft={{
        initial: { ...card.values, date },
        moreOpen: !card.reviewed && (timeToFix || clientToFix),
        onSave: (values) => {
          void learnFromFix(card, values, locale)
          updateVoiceSession({
            cards: session.cards.map((item) =>
              item.key === card.key
                ? {
                    ...item,
                    reviewed: true,
                    // A cleared time box keeps the slot the draft had.
                    values: { ...values, time: values.time || item.values.time },
                  }
                : item,
            ),
          })
        },
      }}
    />
  )
}
