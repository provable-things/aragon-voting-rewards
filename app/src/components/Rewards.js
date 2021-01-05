import React from 'react'
import { Table, TableHeader, TableRow, TableCell, Text, Tag } from '@aragon/ui'
import { useAppState } from '@aragon/api-react'
import NoRewards from './NoRewards'
import { strip } from '../utils/amount-utils'
import { UNLOCKED, WITHDRAWN } from '../utils/rewards-utils'
import { parseSeconds } from '../utils/time-utils'
import { useRewards } from '../hooks/rewards'

const Rewards = (_props) => {
  const { rewardsToken } = useAppState()
  const rewards = useRewards()

  return rewards && rewards.length > 0 && rewardsToken ? (
    <Table
      header={
        <TableRow>
          <TableHeader title={`REWARDS HISTORY`} />
        </TableRow>
      }
    >
      {rewards.map(({ amountWithSymbol, state, remainder }, _index) => {
        return (
          <TableRow key={_index}>
            <TableCell>
              <Text>{amountWithSymbol}</Text>
            </TableCell>
            <TableCell>
              {state === WITHDRAWN ? <Tag mode="new">WITHDRAWN</Tag> : <Tag mode="identifier">UNLOCKED</Tag>}
            </TableCell>
            <TableCell
              css={`
                font-weight: bold;
              `}
            >
              {state === UNLOCKED ? (remainder !== '0 seconds' ? remainder : 'Collectable') : 'Collected'}
            </TableCell>
          </TableRow>
        )
      })}
    </Table>
  ) : (
    <NoRewards />
  )
}

export default Rewards
