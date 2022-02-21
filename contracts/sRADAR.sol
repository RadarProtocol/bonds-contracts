// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract sRADAR is ERC20 {
    using SafeERC20 for IERC20;

    address public owner;
    address private immutable RADAR;

    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized");
        _;
    }

    constructor(address _radar) ERC20("Staked Radar", "sRADAR") {
        owner = msg.sender;
        RADAR = _radar;
    }

    // Internal functions

    function _stake(address _user, uint256 _amount) internal {
        uint256 _totalShares = totalSupply();
        uint256 _totalTokens = IERC20(RADAR).balanceOf(address(this));
        uint256 _mintAmount;

        if (_totalShares == 0) {
            _mintAmount = _amount;
        } else {
            _mintAmount = (_amount * _totalShares) / _totalTokens;
        }

        IERC20(RADAR).safeTransferFrom(_user, address(this), _amount);
        _mint(_user, _mintAmount);
    }

    function _withdraw(address _user, address _recipient, uint256 _amount) internal {
        uint256 _totalShares = totalSupply();
        uint256 _totalTokens = IERC20(RADAR).balanceOf(address(this));
        uint256 _withdrawAmount = (_amount * _totalTokens) / _totalShares;

        _burn(_user, _amount);
        IERC20(RADAR).safeTransfer(_recipient, _withdrawAmount);
    }

    // External functions

    function stake(uint256 _amount) external {
        _stake(msg.sender, _amount);
    }

    function withdraw(address _recipient, uint256 _amount) external {
        _withdraw(msg.sender, _recipient, _amount);
    }

    function withdrawFor(address _user, address _recipient, uint256 _amount) external {
        uint256 currentAllowance = allowance(_user, msg.sender);
        require(currentAllowance >= _amount, "ERC20: transfer amount exceeds allowance");
        unchecked {
            _approve(_user, msg.sender, currentAllowance - _amount);
        }

        _withdraw(_user, _recipient, _amount);
    }
}
