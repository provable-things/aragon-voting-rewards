pragma solidity 0.4.24;

import "@aragon/apps-voting/contracts/Voting.sol";


// NOTE: used because truffle does not support function overloading
contract VotingMock is Voting {
    function newVoteExt(bytes _executionScript, string _metadata, bool _castVote, bool _executesIfDecided)
        external
        returns (uint256)
    {
        return _newVote(_executionScript, _metadata, _castVote, _executesIfDecided);
    }
}