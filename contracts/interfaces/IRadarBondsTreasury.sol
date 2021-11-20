// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IRadarBondsTreasury {

    event BondDataUpdated(address bond, bool enabled, uint256 allowance, uint256 fee);
    event OwnershipPassed(address oldOwner, address newOwner);

    // Bond Functions

    function getReward(uint256 _rewardAmount) external;
    
    // State Getters
    function getOwner() external view returns (address);

    function getPendingOwner() external view returns (address);

    function getDAO() external view returns (address);

    function getToken() external view returns (address);

    function getIsRegisteredBond(address _bond) external view returns (bool);

    function getBondTokenAllowance(address _bond) external view returns (uint256);

    function getBondFee(address _bond) external view returns (uint256);
}