// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IRadarBondsTreasury.sol";

contract RadarBondsTreasury is IRadarBondsTreasury {

    using SafeERC20 for IERC20;

    uint256 private constant FEE_DIVISOR = 10000;

    address private owner;
    address private pendingOwner;
    address private RADAR;
    address private RADAR_DAO;
    mapping(address => bool) private isRegisteredBond;
    mapping(address => uint256) private bondAllowance;
    mapping(address => uint256) private bondFee;

    modifier onlyOwner {
        require(msg.sender == owner, "Unauthorized");
        _;
    }

    modifier onlyBond {
        require(isRegisteredBond[msg.sender], "Unauthorized");
        _;
    }

    constructor(
        address _radar,
        address _dao
    ) {
        RADAR = _radar;
        RADAR_DAO = _dao;
        owner = msg.sender;
    }

    // Owner Functions
    function withdrawToken(address _token, uint256 _amount, address _dest) external onlyOwner {
        IERC20(_token).safeTransfer(_dest, _amount);
    }

    function setBondData(
        address _bond,
        bool _enabled,
        uint256 _allowance,
        uint256 _fee
    ) external onlyOwner {
        isRegisteredBond[_bond] = _enabled;
        bondAllowance[_bond] = _allowance;
        bondFee[_bond] = _fee;

        emit BondDataUpdated(_bond, _enabled, _allowance, _fee);
    }

    function passOwnership(address _newOwner) external onlyOwner {
        pendingOwner = _newOwner;
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Unauthorized");
        address oldOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);

        emit OwnershipPassed(oldOwner, owner);
    }

    function changeDAO(address _newDAO) external onlyOwner {
        RADAR_DAO = _newDAO;
    }

    // Bond Functions

    function getReward(uint256 _rewardAmount) external override onlyBond {
        require(bondAllowance[msg.sender] >= _rewardAmount, "Bond Sold Out");
        bondAllowance[msg.sender] = bondAllowance[msg.sender] - _rewardAmount;

        require(IERC20(RADAR).balanceOf(address(this)) >= _rewardAmount, "Not enough tokens for reward");

        uint256 _fee = (_rewardAmount * bondFee[msg.sender]) / FEE_DIVISOR;
        if (_fee != 0) {
            IERC20(RADAR).safeTransfer(RADAR_DAO, _fee);
        }

        IERC20(RADAR).safeTransfer(msg.sender, (_rewardAmount - _fee));
    }

    // State Getters
    function getOwner() external override view returns (address) {
        return owner;
    }

    function getPendingOwner() external override view returns (address) {
        return pendingOwner;
    }

    function getDAO() external override view returns (address) {
        return RADAR_DAO;
    }

    function getToken() external override view returns (address) {
        return RADAR;
    }

    function getIsRegisteredBond(address _bond) external override view returns (bool) {
        return isRegisteredBond[_bond];
    }

    function getBondTokenAllowance(address _bond) external override view returns (uint256) {
        return bondAllowance[_bond];
    }

    function getBondFee(address _bond) external override view returns (uint256) {
        return bondFee[_bond];
    }
}