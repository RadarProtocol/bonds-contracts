// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IRadarBondsTreasury.sol";
import "./interfaces/IRadarBond.sol";
import "./interfaces/IRadarStaking.sol";

contract RadarBond is IRadarBond {

    mapping(address => BondInfo) private bonds;
    BondTerms private terms;

    address private TREASURY;
    address private STAKING;
    address private immutable PAYOUT_ASSET;
    address private immutable BOND_ASSET;

    uint256 private constant DISCOUNT_DIVISOR = 10000;

    modifier onlyManager {
        require(msg.sender == getManager(), "Unauthorized");
        _;
    }

    constructor (
        address _treasury,
        address _payoutAsset,
        address _bondAsset,
        address _staking,
        uint256 _depositLimit, // bondAsset is LP token, so this limit is that amount of bondAsset in the deposited LP tokens
        uint256 _vestingTime,
        uint256 _bondDiscount
    ) {
        TREASURY = _treasury;
        PAYOUT_ASSET = _payoutAsset;
        BOND_ASSET = _bondAsset;
        STAKING = _staking;
        terms = BondTerms({
            bondLimit: _depositLimit,
            vestingTime: _vestingTime,
            bondDiscount: _bondDiscount
        });
    }

    // Manager functions
    function changeTerms(
        uint256 _depositLimit, // bondAsset is LP token, so this limit is that amount of bondAsset in the deposited LP tokens
        uint256 _vestingTime,
        uint256 _bondDiscount
    ) external onlyManager {
        terms = BondTerms({
            bondLimit: _depositLimit,
            vestingTime: _vestingTime,
            bondDiscount: _bondDiscount
        });
    }

    function changeTreasury(address _newTreasury) external onlyManager {
        TREASURY = _newTreasury;
    }

    function changeStaking(address _newStaking) external onlyManager {
        STAKING = _newStaking;
    }

    // Bond functions
    function bond(uint256 _amount) external override {
        // TODO: Implement
    }

    function redeem(bool _stake) external override {
        // TODO: Implement
    }

    // Internal functions
    function _payoutToLPBondAsset(uint256 _payoutAssetAmount) internal view returns (uint256) {
        // TODO: IMPLEMENT
        // TODO: MAKE SURE THE FOLLOWING IS CORRECT
        // Get PAYOUT_ASSET reserve from BOND_ASSET's LP pair (pancakeswap) - use Uniswap Interface
        // divide _payoutAssetAmount by PAYOUT_ASSET reserve (keep track of decimals)
        // multiply this with the total supply of bond asset

        // Pool with 1000 RADAR and 1 ETH - total supply of 10 LP tokens
        // limit of 10 RADAR
        // 10/1000 = 0.01
        // 0.01 * 10 = 0.1 LP tokens MAX

        // TODO: MAKE SURE IT IS SAFE TO MULTIPLY/DIVIDE RESERVE NUMBERS BY 2 FROM LOOKING AT UNISWAP/PANCAKESWAP CODE

        return 0;
    }

    // State getters
    function getManager() public view override returns (address) {
        return IRadarBondsTreasury(TREASURY).getOwner();
    }

    function getBondingTerms() external view override returns (BondTerms memory) {
        return terms;
    }

    function getBond(address _owner) external view override returns (BondInfo memory) {
        return bonds[_owner];
    }

    function getTreasury() external view override returns (address) {
        return TREASURY;
    }

    function getStaking() external view override returns (address) {
        return STAKING;
    }

    function getPayoutAsset() external view override returns (address) {
        return PAYOUT_ASSET;
    }

    function getBondAsset() external view override returns (address) {
        return BOND_ASSET;
    }

    function getMaxBondAmount() external view override returns (uint256) {
        return _payoutToLPBondAsset(terms.bondLimit);
    }
}