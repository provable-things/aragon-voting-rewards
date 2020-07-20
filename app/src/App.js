import React, { Fragment } from 'react'
import { useAppLogic } from './hooks'
import { Button, Header, Main, SidePanel, SyncIndicator } from '@aragon/ui'
import { useGuiStyle } from '@aragon/api-react'
import { Row, Col } from 'react-bootstrap'
import EpochDetails from './components/EpochDetails'

const App = () => {
  const {
    isSyncing,
    actions,
    panelState,
    votes,
    rewards,
    rewardsToken,
    epoch,
  } = useAppLogic()

  const { appearance } = useGuiStyle()

  const handleClick = () => {}

  return (
    <Main theme={appearance}>
      {isSyncing ? (
        <SyncIndicator />
      ) : (
        <Fragment>
          <Header
            primary="Voting Reward"
            secondary={
              <React.Fragment>
                <Button
                  mode="strong"
                  label={'Get Rewards'}
                  onClick={(_e) => {
                    //panelState.requestOpen(_e)
                  }}
                />
              </React.Fragment>
            }
          />
          <SidePanel
            title={`title`}
            opened={panelState.visible}
            onClose={(_e) => {
              panelState.requestClose(_e)
            }}
            onTransitionEnd={panelState.endTransition}
          >
            TODO
          </SidePanel>
          <Row>
            <Col xs={12} xl={4}>
              <EpochDetails
                rewardsToken={rewardsToken}
                votes={votes}
                rewards={rewards}
                epoch={epoch}
              />
            </Col>
          </Row>
        </Fragment>
      )}
    </Main>
  )
}

export default App
