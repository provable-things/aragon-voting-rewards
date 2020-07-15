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
    initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward) fails
      ✓ Should revert when passed non-contract address as baseVault (407ms)
      ✓ Should revert when passed non-contract address as rewardsVault (272ms)
      ✓ Should revert when passed non-contract address as voting (227ms)
      ✓ Should revert when passed non-contract address as deposit token (217ms)
    initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward)
      ✓ Should set correct variables
      ✓ Should set able to change baseVault, rewardsVault voting and minimun seconds (227ms)
      ✓ Should not be able to set epoch because of no permission
      ✓ Should not be able to set a new Base Vault because of no permission
      ✓ Should not be able to set a new Reward Vault because of no permission
      ✓ Should not be able to set a new Voting because of no permission
      ✓ Should not be able to set a new Percentage Reward because of no permission
      ✓ Should not be able to set a new Percentage Reward because vaule is greater than 100 (58ms)
      claimReward() init fails
        ✓ Should fail because of no permission to collectRewards rewards
        ✓ Should fail because of not votes (65ms)
        ✓ Should fail on opening an epoch claimi because no permission (39ms)
        ✓ Should fail because it is not possible to claim for an epoch is closed (152ms)
      claimReward()
        ✓ Should not be able to open a claim because claimStart is less than last claim (4233ms)
        ✓ Should be able to collect rewards for who partecipated actively in voting because an epoch is passed (TO FINISH) (9631ms)
        ✓ Should not be able to open a claim if there is another one opened (9096ms)
        ✓ Should not be able to claim 2 times for the same epoch (8944ms)


  20 passing (48s)
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