// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IRadarBond {

    struct BondTerms {
        uint256 bondLimit; // bond limit in RADAR
        uint256 vestingTime; // Vesting time in seconds
        uint256 bondDiscount; // % of deposit in rewards (divisor 10000)
    }

    struct BondInfo {
        address owner; // Bond Owner
        uint256 leftToVest; // how many seconds to full vesting
        uint256 creationTimestamp; // When was the bond created/updated
        uint256 payout; // payout in RADAR when fully vested
    }

    event BondCreated(address indexed owner, uint256 bondedAssets, uint256 payout, uint256 vestingDate);
    event BondRedeemed(address indexed owner, uint256 payoutRedeemed, uint256 payoutRemaining, uint256 vestingRemaining);

    function getBondingTerms() external view returns (BondTerms memory);

    function getBond(address _owner) external view returns (BondInfo memory);

    function getManager() external view returns (address);

    function getTreasury() external view returns (address);

    function getStaking() external view returns (address);

    function getPayoutAsset() external view returns (address);

    function getBondAsset() external view returns (address);

    function getMaxBondAmount() external view returns (uint256); 

    function bond(uint256 _amount) external;

    function redeem(bool _stake) external;
}