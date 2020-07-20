import React from 'react'
import { Table, TableHeader, TableRow, TableCell, Text, Tag } from '@aragon/ui'
import NoRewards from './NoRewards'
import PropTypes from 'prop-types'
import { strip } from '../utils/amount-utils'
import { UNLOCKED, WITHDRAWN } from '../utils/rewards-utils'
import { parseSeconds } from '../utils/time-utils'

const Rewards = (_props) => {
  const { rewards, rewardsToken } = _props

  const now = new Date().getTime() / 1000

  return rewards && rewards.length > 0 && rewardsToken ? (
    <Table
      header={
        <TableRow>
          <TableHeader title={`REWARDS HISTORY`} />
        </TableRow>
      }
    >
      {rewards.map(({ amount, state, lockDate, lockTime }, _index) => {
        return (
          <TableRow key={_index}>
            <TableCell>
              <Text>{`${strip(amount.toString())} ${
                rewardsToken.symbol
              }`}</Text>
            </TableCell>
            <TableCell>
              {state === WITHDRAWN ? (
                <Tag mode="new">WITHDRAWN</Tag>
              ) : (
                <Tag mode="identifier">UNLOCKED</Tag>
              )}
            </TableCell>
            <TableCell
              css={`
                font-weight: bold;
              `}
            >
              {state === UNLOCKED
                ? parseSeconds(lockDate + lockTime - now)
                : 'Completed'}
            </TableCell>
          </TableRow>
        )
      })}
    </Table>
  ) : (
    <NoRewards />
  )
}

Rewards.propTypes = {
  rewards: PropTypes.array,
  rewardsToken: PropTypes.object,
}

export default Rewards
