import { useMemo } from 'react'
import { useAppState } from '@aragon/api-react'
import { offChainFormat, strip } from '../utils/amount-utils'
import { parseSeconds } from '../utils/time-utils'
import { UNLOCKED } from '../utils/rewards-utils'
import BLOCK_TIMES from '../utils/block-times'

const useRewards = () => {
  const { rewards, rewardsToken, settings } = useAppState()

  return useMemo(() => {
    const now = new Date().getTime() / 1000

    return rewards.map((_reward) => {
      const { amount, state, lockDate, lockTime } = _reward

      const remainder = lockDate + lockTime * BLOCK_TIMES[settings.network.type] - now

      return {
        ..._reward,
        amountWithSymbol: `${strip(offChainFormat(amount, rewardsToken.decimals).toString())} ${rewardsToken.symbol}`,
        remainder: state === UNLOCKED && remainder > 0 ? parseSeconds(remainder) : 0,
      }
    })
  }, [rewards])
}

export { useRewards }
