import { useCallback } from 'react'
import { useAragonApi, useAppState } from '@aragon/api-react'

const useCollectRewardAction = () => {
  const { api } = useAragonApi()

  return useCallback(
    (_receiver) => {
      try {
        api.collectRewardFor(_receiver).toPromise()
      } catch (error) {
        console.error(error)
      }
    },
    [api]
  )
}

const useAppLogic = () => {
  const {
    account,
    settings,
    voting,
    baseVault,
    rewardsVault,
    rewardToken,
    votingToken,
    isSyncing,
    epoch,
    percentageReward,
    votes,
    rewards,
  } = useAppState()

  const actions = {
    collect: useCollectRewardAction(),
  }

  return {
    actions,
    isSyncing,
    account,
    settings,
    voting,
    baseVault,
    rewardsVault,
    rewardToken,
    epoch,
    percentageReward,
    votes,
    rewards,
    votingToken,
  }
}

export { useCollectRewardAction, useAppLogic }
