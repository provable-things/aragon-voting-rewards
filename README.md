# :moneybag: voting-reward

An Aragon app that allows to get rewards in base of how many votes you made in a certain amount of time.

&nbsp;

***

&nbsp;

## :clipboard: How to run locally

```
yarn install
```

```
yarn start
```

&nbsp;

***

&nbsp;

## :guardsman: Test

```
yarn test
```

### Result

```
    initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward, uint64 _lockTime, uint256 _missingVotesThreeshold) fails
      ✓ Should revert when passed non-contract address as baseVault (459ms)
      ✓ Should revert when passed non-contract address as rewardsVault (250ms)
      ✓ Should revert when passed non-contract address as voting (226ms)
      ✓ Should revert when passed non-contract address as deposit token (213ms)
      ✓ Should revert when passed a negative lock time (202ms)
      ✓ Should revert when passed a negative missing votes threeshold (202ms)
    initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward, uint64 _lockTime, uint256 _missingVotesThreeshold)
      ✓ Should set correct variables (62ms)
      ✓ Should set able to change baseVault, rewardsVault, voting, epochDuration, percentageReward, lockTime and missingVotesThreeshold (347ms)
      ✓ Should not be able to set epoch because of no permission
      ✓ Should not be able to set a new Base Vault because of no permission
      ✓ Should not be able to set a new Reward Vault because of no permission (38ms)
      ✓ Should not be able to set a new Voting because of no permission (38ms)
      ✓ Should not be able to set a new Percentage Reward because of no permission (38ms)
      ✓ Should not be able to set a new lock time because of no permission
      ✓ Should not be able to set a new missing votes threeshold because of no permission (38ms)
      ✓ Should not be able to set a new Percentage Reward because vaule is greater than 100 (57ms)
      rewards init fails
        ✓ Should fail distributing rewards because of no permission
        ✓ Should fail because of no votes (67ms)
        ✓ Should fail on opening a claim for an epoch because no permission
        ✓ Should fail because it is not possible to claim for an epoch is closed (91ms)
      rewards
        ✓ Should not be able to open a claim because claimStart is less than last claim (4421ms)
        ✓ Should be able to collect and distribute rewards for who partecipated actively in voting (12747ms)
        ✓ Should be able to collect rewards but not distributing for who partecipated actively in voting because a LOCK_TIME period is not passed, (12190ms)
        ✓ Should be able to collect but not distribute all rewards (only tot/2) (20154ms)
        ✓ Should not be able to open a claim if there is another one opened (9940ms)
        ✓ Should not be able to collect rewards 2 times in the same epoch (10276ms)
        ✓ Should not be possible open a claim 2 times in the same epoch (112ms)
        ✓ Should handle correctly the number of epochs (3131ms)
        ✓ Should change from Locked to Distributed (10306ms)


  29 passing (2m)
```

&nbsp;

***

&nbsp;

## :rocket: How to publish

Create an __`.env`__ file with the following format

```
PRIVATE_KEY=
INFURA_KEY=
```

Run the local IPFS node:

```
aragon ipfs start
```

and then publish.

```
npx buidler publish "version or patch/minor/major" --network "rinkeby or mainnet"
```