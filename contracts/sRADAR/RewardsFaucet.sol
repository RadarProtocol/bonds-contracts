/*
 Copyright (c) 2022 Radar Global

 Permission is hereby granted, free of charge, to any person obtaining a copy of
 this software and associated documentation files (the "Software"), to deal in
 the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract RewardsFaucet {
    using SafeERC20 for IERC20;

    address public owner;
    address public pendingOwner;
    address public pokeMe;

    address public staking;

    address public immutable RADAR;

    uint256 public duration;
    uint256 public finishTimestamp = 0;
    uint256 public rewardRate;
    uint256 public lastDrip;
    uint256 public dripInterval;

    modifier onlyOwner {
        require(msg.sender == owner, "Unauthorized");
        _;
    }

    modifier canDrip() {
        require(block.timestamp >= lastDrip + dripInterval && lastDrip < finishTimestamp, "Cannot Drip Now");
        _;
    }

    modifier onlyPokeMe() {
        require(msg.sender == pokeMe, "Unauthorized");
        _;
    }

    constructor(address _radar, uint256 _duration, address _pokeMe, uint256 _dripInterval, address _staking) {
        owner = msg.sender;
        RADAR = _radar;
        duration = _duration;
        pokeMe = _pokeMe;
        dripInterval = _dripInterval;
        staking = _staking;
    }

    // Gelato Functions

    function drip() external onlyPokeMe canDrip {
        uint256 _rewardAmount = ((block.timestamp >= finishTimestamp ? finishTimestamp : block.timestamp) - lastDrip) * rewardRate;
        lastDrip = block.timestamp;

        IERC20(RADAR).safeTransfer(staking, _rewardAmount);
    }

    // Owner Functions

    function addedRewards(uint256 _amount) external onlyOwner {
        if (block.timestamp >= finishTimestamp) {
            rewardRate = _amount / duration;
        } else {
            uint256 remaining = finishTimestamp - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (_amount + leftover) / duration;
        }
        lastDrip = block.timestamp;
        finishTimestamp = block.timestamp + duration;
    }

    // be careful if withdrawing RADAR since it can mess up the release schedule
    function withdrawTokens(address _token, uint256 _amount, address _to) external onlyOwner {
        IERC20(_token).safeTransfer(_to, _amount);
    }

    function changeStaking(address _newStaking) external onlyOwner {
        staking = _newStaking;
    }

    function changeDripInterval(uint256 _newInterval) external onlyOwner {
        dripInterval = _newInterval;
    }

    function changeDuration(uint256 _newDuration) external onlyOwner {
        require(block.timestamp > finishTimestamp, "Cannot change duration now");
        duration = _newDuration;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        pendingOwner = _newOwner;
    }

    function claimOwnership() external {
        require(msg.sender == pendingOwner, "Unauthorized");

        owner = pendingOwner;
        pendingOwner = address(0);
    }
}