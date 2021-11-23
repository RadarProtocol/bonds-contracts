// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IRadarBondsTreasury.sol";
import "./interfaces/IRadarBond.sol";
import "./interfaces/IRadarStaking.sol";
import "./external/IUniswapV2Pair.sol";

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
        uint256 _depositLimit, // bondAsset is LP token, so this limit max reward of payout token per user
        uint256 _vestingTime,
        uint256 _bondDiscount
    ) {
        TREASURY = _treasury;
        PAYOUT_ASSET = _payoutAsset;
        BOND_ASSET = _bondAsset;
        STAKING = _staking;
        terms = BondTerms({
            bondPayoutLimit: _depositLimit,
            vestingTime: _vestingTime,
            bondDiscount: _bondDiscount
        });
    }

    // Manager functions
    function changeTerms(
        uint256 _depositLimit, // bondAsset is LP token, so this limit max reward of payout token per user
        uint256 _vestingTime,
        uint256 _bondDiscount
    ) external onlyManager {
        terms = BondTerms({
            bondPayoutLimit: _depositLimit,
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
    function bond(uint256 _amount, uint256 _minReward) external override {
        // TODO: Implement
    }

    function redeem(bool _stake) external override {
        // TODO: Implement
    }

    // Internal functions
    function _rewardToLPBondAsset(uint256 _payoutAssetAmount) internal view returns (uint256) {
        // TODO: IMPLEMENT
        // TODO: OPOSITE of _calculateReward()

        // TODO: MAKE SURE IT IS SAFE TO MULTIPLY/DIVIDE RESERVE NUMBERS BY 2 FROM LOOKING AT UNISWAP/PANCAKESWAP CODE

        return 0;
    }

    function _calculateReward(uint256 _bondAssetAmount) internal view returns (uint256) {
        // TODO: IMPLEMENT
    }

    // TODO: VERY IMPORTANT!!!! TEST!!!!
    // TODO: ALSO TEST WITH A FLASHLOAN (on Uniswap) AND SANDWHICH ATTACK
    function _getPayoutAssetValueFromBondAsset(uint256 _bondAssetAmount) internal view returns (uint256) {
        (uint256 _reserve0, uint256 _reserve1, ) = IUniswapV2Pair(BOND_ASSET).getReserves();
        uint256 _totalSupply = IUniswapV2Pair(BOND_ASSET).totalSupply();

        // YOU CAN USE THE K VALUE AND THE TWAP PRICE OF RADAR IN RESPECT TO THE OTHER ASSET
        // THEN, JUST USE THE FORMULA HERE: https://cmichel.io/pricing-lp-tokens/
        // LOOK AT THE TWARS SECTION. YOU MIGHT NEED TWAPs, OR MAYBE YOU MIGHT NOT

        // CALCULATE THE r0' AND THE r1' AND SEE WHICH IS FOR RADAR => r'
        // USE THAT AS A "FAIR-RESERVE"
        // THEN RETURN (_bondAssetAmount / _totalSupply) * r' (keep in mind decimals)
        // THIS MAY BE VULNERABLE TO FLASHLOAN SANDWHICH ATTACKS OR PAIR-SPECIFIC DRAINING ATTACKS

        // OR DO THE SAME THING BUT WITH TWAP PRICES (SEE HOW ALPHA FINANCE DOES IT)
        // BUT DONT USE CHAINLINK ORACLES
        // THIS MIGHT GIVE LOWER REWARDS WHEN PRICE IS GOING UP
        // SINCE TWAP WILL STAY DOWN BECAUSE OF THE AVERAGE

        // IF ALL OF THE ABOVE FAILS, JUST USE THE CONTRACT WITH tx.origin SAME TX-DOUBLE DEPOSIT PROTECTION
        // AND BELIEVE IN THE BOND's MAX REWARD LIMIT AND ADD REWARDS REGULARLY

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

    function estimateReward(uint256 _bondAssetAmount) external override view returns (uint256) {
        return _calculateReward(_bondAssetAmount);
    }

    function getMaxBondAmount() public view override returns (uint256) {
        uint256 _bondLimit = _rewardToLPBondAsset(terms.bondPayoutLimit);
        uint256 _payoutLeftTreasury = IRadarBondsTreasury(TREASURY).getBondTokenAllowance(address(this));
        uint256 _treasuryLimit = _rewardToLPBondAsset(_payoutLeftTreasury);
        if (_bondLimit < _treasuryLimit) {
            return _bondLimit;
        } else {
            return _treasuryLimit;
        }
    }
}