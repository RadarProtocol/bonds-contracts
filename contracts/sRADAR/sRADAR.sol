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

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract sRADAR is ERC20 {
    using SafeERC20 for IERC20;

    address public owner;
    address public pendingOwner;

    address private immutable RADAR;

    uint256 private lockTime; // Lock time in seconds since deposit, cannot withdraw/transfer tokens
    mapping(address => uint256) private unlockTime; // Mapping of each user's timestamp when the tokens will be unlocked. 0 if never deposited.

    bytes32 immutable public DOMAIN_SEPARATOR;
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    mapping(address => uint) public permitNonces;

    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized");
        _;
    }

    constructor(address _radar, uint256 _lockTime, string memory _version) ERC20("Staked Radar", "sRADAR") {
        owner = msg.sender;
        RADAR = _radar;
        lockTime = _lockTime;

        // Build DOMAIN_SEPARATOR
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("sRADAR")),
                keccak256(bytes(_version)),
                block.chainid,
                address(this)
            )
        );
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

    // EIP-2612: permit() https://eips.ethereum.org/EIPS/eip-2612
    function permit(address _owner, address _spender, uint _value, uint _deadline, uint8 _v, bytes32 _r, bytes32 _s) external {
        require(_deadline >= block.timestamp, "Permit: EXPIRED");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMIT_TYPEHASH, _owner, _spender, _value, permitNonces[_owner]++, _deadline))
            )
        );
        address recoveredAddress = ecrecover(digest, _v, _r, _s);
        require(recoveredAddress != address(0) && recoveredAddress == _owner, "Permit: INVALID_SIGNATURE");
        _approve(_owner, _spender, _value);
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
