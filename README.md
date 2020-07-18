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
      ✓ Should revert when passed non-contract address as baseVault (491ms)
      ✓ Should revert when passed non-contract address as rewardsVault (230ms)
      ✓ Should revert when passed non-contract address as voting (232ms)
      ✓ Should revert when passed non-contract address as deposit token (220ms)
      ✓ Should revert when passed a negative lock time (195ms)
      ✓ Should revert when passed a negative missing votes threeshold (208ms)
    initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward, uint64 _lockTime, uint256 _missingVotesThreeshold)
      ✓ Should set correct variables (62ms)
      ✓ Should set able to change baseVault, rewardsVault, voting, epochDuration, percentageReward, lockTime and missingVotesThreeshold (336ms)
      ✓ Should not be able to set epoch because of no permission (40ms)
      ✓ Should not be able to set a new Base Vault because of no permission (40ms)
      ✓ Should not be able to set a new Reward Vault because of no permission (38ms)
      ✓ Should not be able to set a new Voting because of no permission (41ms)
      ✓ Should not be able to set a new Percentage Reward because of no permission (38ms)
      ✓ Should not be able to set a new lock time because of no permission
      ✓ Should not be able to set a new missing votes threeshold because of no permission (38ms)
      ✓ Should not be able to set a new Percentage Reward because vaule is greater than 100 (57ms)
      rewards init fails
        ✓ Should fail distributing rewards because of no permission (38ms)
        ✓ Should fail because of no votes (68ms)
        ✓ Should fail on opening a claim for an epoch because no permission (38ms)
        ✓ Should fail because it is not possible to claim for an epoch is closed (92ms)
      rewards
        ✓ Should not be able to open a claim because claimStart is less than last claim (4681ms)
        ✓ Should be able to collect and distribute rewards for who partecipated actively in voting (13577ms)
        ✓ Should be able to collect rewards but not distributing for who partecipated actively in voting because a LOCK_TIME period is not passed, (12935ms)
        ✓ Should be able to collect but not distribute all rewards (only tot/2) (24668ms)
        ✓ Should not be able to open a claim if there is another one opened (9896ms)
        ✓ Should not be able to collect rewards 2 times in the same epoch (10089ms)
        ✓ Should not be possible open a claim 2 times in the same epoch (87ms)
        ✓ Should handle correctly the number of epochs (2847ms)


  28 passing (2m)
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