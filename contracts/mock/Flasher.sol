// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./../interfaces/IRadarBond.sol";
import "./../external/IERC20Extra.sol";
import "./../external/IUniswapV2Pair.sol";
import "./../external/IUniswapV2Router02.sol";

contract Flasher {
    address private BOND;
    address private UNISWAP_ROUTER;

    constructor (address _bond, address _uniswap) {
        BOND = _bond;
        UNISWAP_ROUTER = _uniswap;
    }

    function doFlashDeposit() external {
        address _lpAsset = IRadarBond(BOND).getBondAsset();
        address _payoutAsset = IRadarBond(BOND).getPayoutAsset();

        uint256 _lpBal = IERC20Extra(_lpAsset).balanceOf(address(this));
        uint256 _payoutBal = IERC20Extra(_payoutAsset).balanceOf(address(this));

        require(_lpBal > 0, "LP assets not transferred to contract");
        require(_payoutBal > 0, "Payout assets not transferred to contract");

        address WETH = IUniswapV2Router02(UNISWAP_ROUTER).WETH();
        address[] memory _path = new address[](2);
        _path[0] = _payoutAsset;
        _path[1] = WETH;

        // Crash price
        IERC20Extra(_payoutAsset).approve(UNISWAP_ROUTER, _payoutBal);
        IUniswapV2Router02(UNISWAP_ROUTER).swapExactTokensForTokens(
            _payoutBal,
            0,
            _path,
            address(this),
            1000000000000
        );

        // Bond assets
        IERC20Extra(_lpAsset).approve(BOND, _lpBal);
        IRadarBond(BOND).bond(_lpBal, 0);
    }

    function doDoubleDeposit() external {
        address _lpAddress = IRadarBond(BOND).getBondAsset();
        uint256 _bondAmount = IERC20Extra(_lpAddress).balanceOf(address(this));

        require(_bondAmount > 0, "Forgot sending tokens");

        uint256 _firstDeposit = _bondAmount / 2;
        uint256 _secondDeposit = _bondAmount - _firstDeposit;

        IERC20Extra(_lpAddress).approve(BOND, _bondAmount);

        IRadarBond(BOND).bond(_firstDeposit, 0);
        IRadarBond(BOND).bond(_secondDeposit, 0);
    }
}