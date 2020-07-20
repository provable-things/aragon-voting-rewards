import { useCallback } from 'react'
import { useAragonApi, useAppState } from '@aragon/api-react'
import { useSidePanel } from './side-panel'

const useCollectRewardAction = (_onDone) => {
  const { api } = useAragonApi()

  return useCallback(
    (_receiver) => {
      try {
        api.collectRewardsFor(_receiver).toPromise()

        _onDone()
      } catch (error) {
        console.error(error)
      }
    },
    [api, _onDone]
  )
}

const useAppLogic = () => {
  const {
    account,
    settings,
    voting,
    baseVault,
    rewardsVault,
    rewardsToken,
    isSyncing,
    epoch,
    percentageRewards,
    votes,
    rewards,
  } = useAppState()

  const panelState = useSidePanel()

  const actions = {
    collect: useCollectRewardAction(panelState.requestClose),
  }

  return {
    actions,
    isSyncing,
    panelState,
    account,
    settings,
    voting,
    baseVault,
    rewardsVault,
    rewardsToken,
    epoch,
    percentageRewards,
    votes,
    rewards,
  }
}

export { useCollectRewardAction, useAppLogic }
