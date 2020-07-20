import React from 'react'
import { Box, EmptyStateCard, GU, textStyle } from '@aragon/ui'

const NoRewards = (_props) => {
  return (
    <Box
      css={`
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        height: ${50 * GU}px;
        ${textStyle('title3')};
      `}
    >
      <EmptyStateCard text="There are no rewards." />
    </Box>
  )
}

export default NoRewards
