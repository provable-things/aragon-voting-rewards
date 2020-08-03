# :moneybag: voting-rewards

An Aragon app that allows to get rewards in base of how many votes you made in a certain amount of time.
As Voting app, it uses the [following](https://github.com/1Hive/dandelion-voting-app) (__`Dandelion Voting`__) as it does not implement the "early voting" functionality, and therefore it's optimal in calculating the rewards.


&nbsp;

***

&nbsp;

## :arrow_down: How to install

```
dao install <DAO address> voting-rewards.open.aragonpm.eth --app-init-args <base vault> <rewards vault> <voting app address> <rewards token address> <epoch duration> <percentage rewards> <lock time> <missing vote threshold> --env aragon:rinkeby
```

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
    initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward, uint64 _lockTime, uint256 _missingVotesThreshold) fails
      ✓ Should revert when passed non-contract address as baseVault (475ms)
      ✓ Should revert when passed non-contract address as rewardsVault (237ms)
      ✓ Should revert when passed non-contract address as voting (228ms)
      ✓ Should revert when passed non-contract address as deposit token (218ms)
      ✓ Should revert when passed a negative lock time (218ms)
      ✓ Should revert when passed a negative missing votes threshold (215ms)
    initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward, uint64 _lockTime, uint256 _missingVotesThreshold)
      ✓ Should set correct variables (140ms)
      ✓ Should set able to change baseVault, rewardsVault, voting, epochDuration, percentageRewards, lockTime, missingVotesThreshold and rewardsToken (414ms)
      ✓ Should not be able to set epoch because of no permission (42ms)
      ✓ Should not be able to set a new Base Vault because of no permission (40ms)
      ✓ Should not be able to set a new Reward Vault because of no permission (42ms)
      ✓ Should not be able to set a new Voting because of no permission (41ms)
      ✓ Should not be able to set a new Percentage Reward because of no permission (38ms)
      ✓ Should not be able to set a new lock time because of no permission (40ms)
      ✓ Should not be able to set a new missing votes threshold because of no permission (39ms)
      ✓ Should not be able to set a new Percentage Reward because vaule is greater than 100 (62ms)
      ✓ Should not be able to set a new rewards token because of no permission (38ms)
      rewards init fails
        ✓ Should fail distributing rewards because of no permission (42ms)
        ✓ Should fail because of no votes (70ms)
        ✓ Should fail on opening a distribition for an epoch because no permission (39ms)
        ✓ Should fail because it is not possible to distribition for an epoch is closed (92ms)
      rewards
        ✓ Should not be able to collect rewards since there are not
        ✓ Should not be able to close distribution since it is not opened
        ✓ Should not be able to open a distribition because startBlockNumberOfCurrentEpoch is less than last distribition (5115ms)
        ✓ Should not be able to distribute rewards because of too many missing votes (5605ms)
        ✓ Should be rewarded respect of the minimun balance in an epoch (1076ms)
        ✓ Should be able to collect, distribute rewards for who partecipated actively in voting and catching events (15728ms)
        ✓ Should not be able to close a reward distribution twice (14354ms)
        ✓ Should be able to collect rewards but not distributing for who partecipated actively in voting because a LOCK_TIME_BLOCKS period is not passed, (14954ms)
        ✓ Should be able to distribute but not collecting all rewards (only tot/2) (22893ms)
        ✓ Should not be able to open a distribition if there is another one opened (11310ms)
        ✓ Should not be able to collect rewards 2 times in the same epoch (11727ms)
        ✓ Should not be possible open a distribition 2 times in the same epoch (195ms)
        ✓ Should handle correctly the number of epochs (1678ms)
        ✓ Should change from Locked to Withdrawn (1281ms)
        ✓ Should not be rewarded if number of votes = missingVotes = missingVotesThreshold (346ms)
        ✓ Should be able to be rewarded (in the next epoch) even if a vote close into the next epoch (532ms)


  37 passing (2m)
```

&nbsp;

***

&nbsp;

## :rocket: How to publish

Create an __`.env`__ file with the following format

```
RINKEBY_PRIVATE_KEY=
MAINNET_PRIVATE_KEY=
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