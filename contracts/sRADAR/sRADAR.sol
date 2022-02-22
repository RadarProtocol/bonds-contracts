// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract sRADAR is ERC20 {
    using SafeERC20 for IERC20;

    address public owner;
    address public pendingOwner;

    address private immutable RADAR;

    uint256 private lockTime;
    mapping(address => uint256) private unlockTime;

    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized");
        _;
    }

    constructor(address _radar, uint256 _lockTime) ERC20("Staked Radar", "sRADAR") {
        owner = msg.sender;
        RADAR = _radar;
        lockTime = _lockTime;
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

        unlockTime[_user] = block.timestamp + lockTime;
        IERC20(RADAR).safeTransferFrom(_user, address(this), _amount);
        _mint(_user, _mintAmount);
    }

    function _withdraw(address _user, address _recipient, uint256 _amount) internal {
        require(block.timestamp >= unlockTime[_user], "Tokens Locked");

        uint256 _totalShares = totalSupply();
        uint256 _totalTokens = IERC20(RADAR).balanceOf(address(this));
        uint256 _withdrawAmount = (_amount * _totalTokens) / _totalShares;

        _burn(_user, _amount);
        IERC20(RADAR).safeTransfer(_recipient, _withdrawAmount);
    }

    // ERC20 overrides

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        require(block.timestamp >= unlockTime[msg.sender], "Tokens Locked");

        // Original Function
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        require(block.timestamp >= unlockTime[sender], "Tokens Locked");

        // Original Function
        _transfer(sender, recipient, amount);

        uint256 currentAllowance = allowance(sender, msg.sender);
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        unchecked {
            _approve(sender, _msgSender(), currentAllowance - amount);
        }

        return true;
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

    // State Getters

    function sharePrice() external view returns (uint256) {
        return (IERC20(RADAR).balanceOf(address(this)) * 10**18) / totalSupply();
    }

    function getRADAR() external view returns (address) {
        return RADAR;
    }

    function getLockTime() external view returns (uint256) {
        return lockTime;
    }

    function getUserUnlockTime(address _user) external view returns (uint256) {
        return unlockTime[_user];
    }

    // Owner functions

    function changeLockTime(uint256 _newLockTime) external onlyOwner {
        lockTime = _newLockTime;
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
