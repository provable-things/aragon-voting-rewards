import { useCallback } from 'react'
import { useAragonApi, useAppState } from '@aragon/api-react'

const useCollectRewardAction = () => {
  const { api } = useAragonApi()

  return useCallback(
    (_receiver) => {
      try {
        api.collectRewardsFor(_receiver).toPromise()
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
    dandelionVoting,
    baseVault,
    rewardsVault,
    rewardsToken,
    votingToken,
    isSyncing,
    epoch,
    percentageRewards,
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
    dandelionVoting,
    baseVault,
    rewardsVault,
    rewardsToken,
    epoch,
    percentageRewards,
    votes,
    rewards,
    votingToken,
  }
}

export { useCollectRewardAction, useAppLogic }
