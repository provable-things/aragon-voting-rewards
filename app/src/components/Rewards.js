import React from 'react'
import { Table, TableHeader, TableRow, TableCell, Text, Tag } from '@aragon/ui'
import { useAppState } from '@aragon/api-react'
import NoRewards from './NoRewards'
import { useRewards } from '../hooks/rewards'

const Rewards = (_props) => {
  const { rewardsToken } = useAppState()
  const { rewards } = useRewards()

  return rewards && rewards.length > 0 && rewardsToken ? (
    <Table
      header={
        <TableRow>
          <TableHeader title={`REWARDS HISTORY`} />
        </TableRow>
      }
    >
      {rewards.map(({ amountWithSymbol, remainder }, _index) => {
        return (
          <TableRow key={_index}>
            <TableCell>
              <Text>{amountWithSymbol}</Text>
            </TableCell>
            <TableCell>
              <Tag mode="identifier">UNLOCKED</Tag>
            </TableCell>
            <TableCell
              css={`
                font-weight: bold;
              `}
            >
              {remainder !== '0 seconds' ? remainder : 'Collectable'}
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
