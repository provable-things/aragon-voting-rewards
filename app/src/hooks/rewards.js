import { useMemo } from 'react'
import { useAppState } from '@aragon/api-react'
import { offChainFormat, strip } from '../utils/amount-utils'
import { parseSeconds } from '../utils/time-utils'
import { UNLOCKED } from '../utils/rewards-utils'

const useRewards = () => {
  const { rewards, rewardsToken } = useAppState()

  return useMemo(() => {
    const now = new Date().getTime() / 1000

    return rewards.map((_reward) => {
      const { amount, state, lockDate, lockTime } = _reward

      return {
        ..._reward,
        amountWithSymbol: `${strip(
          offChainFormat(amount, rewardsToken.decimals).toString()
        )} ${rewardsToken.symbol}`,
        remainder:
          state === UNLOCKED ? parseSeconds(lockDate + lockTime - now) : 0,
      }
    })
  }, [rewards])
}

export { useRewards }
