// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IRadarStaking {

    event RewardAdded(uint256 rewardAmount);
    event Staked(address indexed who, uint256 amount);
    event Withdraw(address indexed who, uint256 amount);
    event GotReward(address indexed who, uint256 rewardAmount);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function getOwner() external view returns (address);

    function rewardPerToken() external view returns (uint256);

    function earned(address account) external view returns (uint256);

    function stake(uint256 amount, address target) external;

    function withdraw(uint256 amount) external;

    function exit() external;

    function getReward() external;
}