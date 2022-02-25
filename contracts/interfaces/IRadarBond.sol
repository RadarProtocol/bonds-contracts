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

interface IRadarBond {

    struct BondTerms {
        uint256 bondPayoutLimit; // bond reward limit in RADAR
        uint256 vestingTime; // Vesting time in seconds
        uint256 bondDiscount; // % of deposit in rewards (divisor 10000)
        uint256 minPrice; // minimum price in terms of RADAR/OTHER LP where bonds will be emmited
    }

    struct BondInfo {
        uint256 leftToVest; // how many seconds to full vesting
        uint256 updateTimestamp; // When was the bond created/updated
        uint256 payout; // payout in RADAR when fully vested
    }

    event BondCreated(address indexed owner, uint256 bondedAssets, uint256 payout, uint256 vestingDate);
    event BondRedeemed(address indexed owner, uint256 payoutRedeemed, uint256 payoutRemaining, uint256 vestingRemaining, bool tokensStaked);

    function getBondingTerms() external view returns (BondTerms memory);

    function getBond(address _owner) external view returns (BondInfo memory);

    function getTotalLPDeposited() external view returns (uint256);

    function getManager() external view returns (address);

    function getTreasury() external view returns (address);

    function getStaking() external view returns (address);

    function getPayoutAsset() external view returns (address);

    function getBondAsset() external view returns (address);

    function getMaxBondAmount() external view returns (uint256); 

    function estimateReward(uint256 _bondAssetAmount) external view returns (uint256);

    function getIsTrustedOrigin(address _origin) external view returns (bool);

    function bond(uint256 _amount, uint256 _minReward) external;

    function redeem(bool _stake) external;
}