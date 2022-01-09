// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IRadarBondsTreasury.sol";
import "./interfaces/IRadarSingleAssetBond.sol";
import "./interfaces/IRadarStaking.sol";
import "./external/IUniswapV2Pair.sol";
import "./external/IERC20Extra.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RadarSingleAssetBond is IRadarSingleAssetBond {

    using SafeERC20 for IERC20;

    mapping(address => BondInfo) private bonds;
    mapping(address => uint256) flashProtection;
    mapping(address => bool) trustedOrigins;
    BondTerms private terms;

    address private TREASURY;
    address private STAKING;
    address private immutable PAYOUT_ASSET;
    address private immutable BOND_ASSET;

    uint256 private constant DISCOUNT_DIVISOR = 10000;

    uint256 private totalLPDeposited = 0;

    modifier onlyManager {
        require(msg.sender == getManager(), "Unauthorized");
        _;
    }

    modifier flashLocked {
        if (!trustedOrigins[tx.origin]) {
            require(block.number > flashProtection[tx.origin], "Flash Protection");
        }
        flashProtection[tx.origin] = block.number;
        _;
    }

    modifier validatePricingPair(address _payoutAsset, address _bondAsset, address _priceLP) {
        address _token0 = IUniswapV2Pair(_priceLP).token0();
        address _token1 = IUniswapV2Pair(_priceLP).token1();
        
        require((_token0 == _payoutAsset && _token1 == _bondAsset) || (_token0 == _bondAsset && _token1 == _payoutAsset), "Invalid Pricing LP");
        _;
    }

    constructor (
        address _treasury,
        address _payoutAsset,
        address _bondAsset,
        address _staking,
        uint256 _depositLimit, // this limit max reward of payout token per user
        uint256 _vestingTime,
        uint256 _bondDiscount,
        address _minPriceLP,
        uint256 _minPrice
    ) validatePricingPair(_payoutAsset, _bondAsset, _minPriceLP) {
        TREASURY = _treasury;
        PAYOUT_ASSET = _payoutAsset;
        BOND_ASSET = _bondAsset;
        STAKING = _staking;
        terms = BondTerms({
            bondPayoutLimit: _depositLimit,
            vestingTime: _vestingTime,
            bondDiscount: _bondDiscount,
            minPriceLP: _minPrice,
            priceLP: _minPriceLP
        });
    }

    // Manager functions
    function changeTerms(
        uint256 _depositLimit, // bondAsset is LP token, so this limit max reward of payout token per user
        uint256 _vestingTime,
        uint256 _bondDiscount,
        uint256 _minPrice,
        address _minPriceLP
    ) external onlyManager validatePricingPair(PAYOUT_ASSET, BOND_ASSET, _minPriceLP) {
        terms = BondTerms({
            bondPayoutLimit: _depositLimit,
            vestingTime: _vestingTime,
            bondDiscount: _bondDiscount,
            minPriceLP: _minPrice,
            priceLP: _minPriceLP
        });
    }

    function changeTreasury(address _newTreasury) external onlyManager {
        TREASURY = _newTreasury;
    }

    function changeStaking(address _newStaking) external onlyManager {
        STAKING = _newStaking;
    }

    function setTrustedOrigin(address _origin, bool _status) external onlyManager {
        trustedOrigins[_origin] = _status;
    }

    // Bond functions
    function bond(uint256 _amount, uint256 _minReward) external override flashLocked {
        require(_amount <= getMaxBondAmount(), "Bond too big");
        (uint256 _reward, uint256 _spotPrice) = _calculateReward(_amount);
        require(_reward >= _minReward, "Slippage minReward");
        require(_spotPrice >= terms.minPriceLP, "Price too low for bond minting");

        IERC20(BOND_ASSET).safeTransferFrom(msg.sender, TREASURY, _amount);
        uint256 _rewardPayout = IRadarBondsTreasury(TREASURY).getReward(_reward);

        bonds[msg.sender] = BondInfo({
            payout: (_rewardPayout + bonds[msg.sender].payout),
            updateTimestamp: block.timestamp,
            leftToVest: terms.vestingTime
        });

        totalLPDeposited = totalLPDeposited + _amount;

        emit BondCreated(msg.sender, _amount, bonds[msg.sender].payout, (block.timestamp + terms.vestingTime));
    }

    // TODO: REWRITE FOR SINGLE ASSET
    function redeem(bool _stake) external override flashLocked {
        BondInfo memory userBond = bonds[msg.sender];

        uint256 _delta = block.timestamp - userBond.updateTimestamp;
        uint256 _vestingTime = userBond.leftToVest;
        uint256 _payout;
        uint256 _leftToVest;

        require(userBond.payout > 0 && _vestingTime > 0, "Bond does not exist");

        if (_delta >= _vestingTime) {
            _payout = userBond.payout;
            _leftToVest = 0;
            delete bonds[msg.sender];
        } else {
            _payout = (userBond.payout * _delta) / _vestingTime;
            _leftToVest = (userBond.leftToVest - _delta);

            bonds[msg.sender] = BondInfo({
                payout: (userBond.payout - _payout),
                leftToVest: _leftToVest,
                updateTimestamp: block.timestamp
            });
        }

        _giveReward(msg.sender, _payout, _stake);
        emit BondRedeemed(
            msg.sender,
            _payout,
            (userBond.payout - _payout),
            _leftToVest,
            _stake
        );
    }

    function _giveReward(address _receiver, uint256 _amount, bool _stake) internal {
        if (_stake) {
            IERC20(PAYOUT_ASSET).safeApprove(STAKING, _amount);
            IRadarStaking(STAKING).stake(_amount, _receiver);
        } else {
            IERC20(PAYOUT_ASSET).safeTransfer(_receiver, _amount);
        }
    }

    // Internal functions
    function _rewardToBondAsset(uint256 _payoutAssetAmount) internal view returns (uint256) {
        
        uint256 _value = (_payoutAssetAmount * DISCOUNT_DIVISOR) / (terms.bondDiscount + DISCOUNT_DIVISOR);
        uint256 _price = _getCurrentLPPrice();
        uint8 _payoutDecimals = IERC20Extra(PAYOUT_ASSET).decimals();
        _value = _value * _price / (10**_payoutDecimals);

        return _value;
    }

    function _calculateReward(uint256 _bondAssetAmount) internal view returns (uint256, uint256) {
        (uint256 _value, uint256 _price) = _getPayoutAssetValueFromBondAsset(_bondAssetAmount);

        uint256 _reward = _value + ((_value * terms.bondDiscount) / DISCOUNT_DIVISOR);

        return (_reward, _price);
        
    }

    function _getCurrentLPPrice() internal view returns (uint256) {
        (uint256 _reserve0, uint256 _reserve1, ) = IUniswapV2Pair(terms.priceLP).getReserves();
        address _token0 = IUniswapV2Pair(terms.priceLP).token0();
        address _token1 = IUniswapV2Pair(terms.priceLP).token1();
        uint8 _token0Decimals = IERC20Extra(_token0).decimals();
        uint8 _token1Decimals = IERC20Extra(_token1).decimals();

        uint256 _price;
        if (_token0 == PAYOUT_ASSET) {
            _price = (_reserve1 * (10**_token0Decimals)) / _reserve0;
        } else {
            _price = (_reserve0 * (10**_token1Decimals)) / _reserve1;
        }

        return _price;
    }

    function _getPayoutAssetValueFromBondAsset(uint256 _bondAssetAmount) internal view returns (uint256, uint256) {
        
        uint256 _price = _getCurrentLPPrice();
        uint8 _payoutDecimals = IERC20Extra(PAYOUT_ASSET).decimals();
        uint256 _value = _bondAssetAmount * (10**_payoutDecimals) / _price;

        return (_value, _price);
    }

    // State getters

    function getTotalLPDeposited() external view override returns (uint256) {
        return totalLPDeposited;
    }

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
        (uint256 _reward, ) =  _calculateReward(_bondAssetAmount);
        return _reward;
    }

    function getIsTrustedOrigin(address _origin) external override view returns (bool) {
        return trustedOrigins[_origin];
    }

    function getMaxBondAmount() public view override returns (uint256) {
        uint256 _bondLimit = _rewardToBondAsset(terms.bondPayoutLimit);
        uint256 _payoutLeftTreasury = IRadarBondsTreasury(TREASURY).getBondTokenAllowance(address(this));
        uint256 _treasuryLimit = _rewardToBondAsset(_payoutLeftTreasury);
        if (_bondLimit < _treasuryLimit) {
            return _bondLimit;
        } else {
            return _treasuryLimit;
        }
    }
}