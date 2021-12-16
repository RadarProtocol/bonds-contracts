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