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
      ✓ Should revert when passed non-contract address as baseVault (428ms)
      ✓ Should revert when passed non-contract address as rewardsVault (232ms)
      ✓ Should revert when passed non-contract address as voting (221ms)
      ✓ Should revert when passed non-contract address as deposit token (223ms)
      ✓ Should revert when passed a negative lock time (226ms)
      ✓ Should revert when passed a negative missing votes threeshold (245ms)
    initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward, uint64 _lockTime, uint256 _missingVotesThreeshold)
      ✓ Should set correct variables (65ms)
      ✓ Should set able to change baseVault, rewardsVault, voting, epochDuration, percentageReward, lockTime and missingVotesThreeshold (470ms)
      ✓ Should not be able to set epoch because of no permission (39ms)
      ✓ Should not be able to set a new Base Vault because of no permission (40ms)
      ✓ Should not be able to set a new Reward Vault because of no permission (38ms)
      ✓ Should not be able to set a new Voting because of no permission
      ✓ Should not be able to set a new Percentage Reward because of no permission (38ms)
      ✓ Should not be able to set a new lock time because of no permission
      ✓ Should not be able to set a new missing votes threeshold because of no permission (44ms)
      ✓ Should not be able to set a new Percentage Reward because vaule is greater than 100 (61ms)
      claimReward() init fails
        ✓ Should fail because of no permission to collectRewards rewards (45ms)
        ✓ Should fail because of not votes (69ms)
        ✓ Should fail on opening an epoch claimi because no permission (38ms)
        ✓ Should fail because it is not possible to claim for an epoch is closed (90ms)
      claimReward()
        ✓ Should not be able to open a claim because claimStart is less than last claim (4153ms)
        ✓ Should be able to collect rewards for who partecipated actively in voting because an epoch is passed (TO FINISH) (9897ms)
        ✓ Should not be able to open a claim if there is another one opened (9705ms)
        ✓ Should not be able to claim 2 times in the same epoch (9273ms)
        ✓ Should not be possible open a claim 2 times in the same epoch (82ms)
        ✓ Should handle correctly the number of epochs (2803ms)


  26 passing (59s)
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