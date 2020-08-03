import { useCallback } from 'react'
import { useAragonApi } from '@aragon/api-react'

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
  const actions = {
    collect: useCollectRewardAction(),
  }

  return {
    actions,
  }
}

export { useCollectRewardAction, useAppLogic }
