import { useMemo } from 'react'
import { useAppState } from '@aragon/api-react'
import {
  findMinimunBalanceInVotesForEpoch,
  getElegibilityOnEpoch,
} from '../utils/rewards-utils'
import { strip } from '../utils/amount-utils'
import { parseSeconds } from '../utils/time-utils'

const useEpochDetails = () => {
  const { epoch, votes } = useAppState()

  return useMemo(() => {
    const current =
      epoch && (epoch.current || epoch.current === 0) ? epoch.current : '-'
    const lockTime =
      epoch && (epoch.lockTime || epoch.lockTime === 0)
        ? parseSeconds(epoch.lockTime)
        : '-'

    const duration =
      epoch && (epoch.duration || epoch.duration === 0)
        ? parseSeconds(epoch.duration)
        : '-'

    const percentageRewards =
      epoch && (epoch.percentageRewards || epoch.percentageRewards === 0)
        ? `${epoch.percentageRewards * 100}%`
        : '-'

    const epochTermination =
      epoch && epoch.startBlock && epoch.duration
        ? new Date((epoch.startDate + epoch.duration) * 1000).toLocaleString()
        : '-'

    let epochRemainder, status
    if (epoch && epoch.duration && epoch.startDate) {
      const start = epoch.startDate * 1000
      const end = (epoch.startDate + epoch.duration) * 1000
      const now = new Date().getTime()

      epochRemainder = (end - now) / 1000
      epochRemainder =
        epochRemainder > 0 ? parseSeconds(epochRemainder) : 'Terminated'

      status = Math.round(((now - start) / (end - start)) * 100) / 100
    }

    let reward, partecipateWith, isElegible, votesInEpoch, minimum
    if (epoch) {
      const minimum = findMinimunBalanceInVotesForEpoch(
        votes,
        epoch.startBlock,
        epoch.startBlock + epoch.durationBlock
      )

      if (minimum) {
        reward = strip(parseInt(minimum.toString()) * epoch.percentageRewards)
        partecipateWith = strip(minimum.toString())
      }

      const eligibility = getElegibilityOnEpoch(
        votes,
        epoch.startBlock,
        epoch.startBlock + epoch.durationBlock,
        epoch.missingVotesThreshold
      )
      isElegible = eligibility.isElegible
      votesInEpoch = eligibility.votesInEpoch
    }

    return {
      current,
      lockTime,
      duration,
      percentageRewards,
      epochTermination,
      epochRemainder: epochRemainder ? epochRemainder : 0,
      status,
      minimum: minimum ? minimum : '-',
      reward: reward ? reward : '-',
      partecipateWith: partecipateWith ? partecipateWith : '-',
      isElegible,
      votesInEpoch: votesInEpoch ? votesInEpoch : [],
    }
  }, [epoch, votes])
}

export { useEpochDetails }
