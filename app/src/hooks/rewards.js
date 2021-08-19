import { useMemo } from 'react'
import { useAppState } from '@aragon/api-react'
import { offChainFormat, strip } from '../utils/amount-utils'
import { parseSeconds } from '../utils/time-utils'
import { UNLOCKED } from '../utils/rewards-utils'
import BLOCK_TIMES from '../utils/block-times'
import BigNumber from 'bignumber.js'

const useRewards = () => {
  const { rewards, rewardsToken, settings } = useAppState()

  return useMemo(() => {
    const now = Math.round(new Date().getTime() / 1000)
    const mappedRewards = rewards.map((_reward) => {
      const { amount, state, lockDate, lockTime } = _reward
      const remainder = lockDate + lockTime * BLOCK_TIMES[settings.network.type] - now

      return {
        ..._reward,
        amountWithSymbol: `${strip(offChainFormat(amount, rewardsToken.decimals).toString())} ${rewardsToken.symbol}`,
        remainder: state === UNLOCKED && remainder > 0 ? parseSeconds(remainder) : '0 seconds',
      }
    })

    const withdrawableRewards = mappedRewards.filter(({ remainder }) => remainder === '0 seconds')

    const totalWithdrawable =
      withdrawableRewards.length > 0
        ? withdrawableRewards.map(({ amount }) => amount).reduce((_acc, _val) => BigNumber(_acc).plus(_val).toFixed())
        : 0

    return {
      rewards: mappedRewards,
      totalWithdrawable,
      formattedTotalWithdrawable:
        totalWithdrawable && rewardsToken
          ? `${strip(offChainFormat(BigNumber(totalWithdrawable), rewardsToken.decimals))} ${rewardsToken.symbol}`
          : null,
    }
  }, [rewards])
}

export { useRewards }
