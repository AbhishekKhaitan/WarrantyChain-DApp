// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  WarrantyChain
 * @notice Tamper-proof, transferable product warranties.
 *
 * Problem: paper warranty cards and bills get lost or forged, second-hand
 * buyers cannot verify whether a product is still under warranty, and
 * service centres cannot see a product's claim history.
 *
 * Roles:
 *  - Manufacturer (contract owner): authorises retailers, resolves claims,
 *    can void fraudulent warranties.
 *  - Authorised retailer: issues a warranty to a buyer at the time of sale.
 *  - Warranty holder (buyer): can transfer the warranty when reselling the
 *    product and can file service claims while the warranty is valid.
 *  - Anyone: can verify a warranty by product serial number.
 */
contract WarrantyChain {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum ClaimStatus { Pending, Approved, Rejected }

    struct Warranty {
        string serialNumber;
        string productModel;
        address holder;
        address retailer;
        uint256 purchaseDate;
        uint256 expiryDate;
        uint256 transferCount;
        bool voided;
        bool exists;
    }

    struct Claim {
        uint256 id;
        string serialNumber;
        string issue;
        address claimant;
        uint256 filedAt;
        ClaimStatus status;
    }

    // ------------------------------------------------------------------
    // State variables
    // ------------------------------------------------------------------

    address public immutable manufacturer;
    string public brandName;
    uint256 public immutable maxWarrantyDays;
    uint256 public constant MAX_OPEN_CLAIMS = 1;

    uint256 public totalWarranties;
    uint256 public totalClaims;

    mapping(address => bool) public authorizedRetailers;
    mapping(bytes32 => Warranty) private warranties;          // key = keccak256(serial)
    mapping(bytes32 => uint256[]) private claimIdsBySerial;
    mapping(bytes32 => uint256) public openClaims;
    mapping(uint256 => Claim) private claims;                  // claimId => Claim
    mapping(address => string[]) private serialsByHolder;      // history of serials ever held
    mapping(address => mapping(bytes32 => bool)) private listedFor;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event RetailerUpdated(address indexed retailer, bool authorized);
    event WarrantyIssued(string serialNumber, address indexed holder, address indexed retailer, uint256 expiryDate);
    event WarrantyTransferred(string serialNumber, address indexed from, address indexed to);
    event WarrantyVoided(string serialNumber, string reason);
    event ClaimFiled(uint256 indexed claimId, string serialNumber, address indexed claimant);
    event ClaimResolved(uint256 indexed claimId, ClaimStatus status);

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier onlyManufacturer() {
        require(msg.sender == manufacturer, "Unauthorized: only manufacturer");
        _;
    }

    modifier onlyRetailer() {
        require(authorizedRetailers[msg.sender], "Unauthorized: not an authorized retailer");
        _;
    }

    modifier warrantyExists(string memory serial) {
        require(warranties[_key(serial)].exists, "Warranty not found");
        _;
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    /**
     * @param _brandName       Manufacturer brand, e.g. "Acme Electronics".
     * @param _maxWarrantyDays Upper limit a retailer may grant (1 - 3650 days).
     */
    constructor(string memory _brandName, uint256 _maxWarrantyDays) {
        require(bytes(_brandName).length > 0, "Brand name required");
        require(_maxWarrantyDays > 0 && _maxWarrantyDays <= 3650, "Max warranty must be 1-3650 days");

        manufacturer = msg.sender;
        brandName = _brandName;
        maxWarrantyDays = _maxWarrantyDays;

        // The manufacturer can also sell directly (e.g. its own web store).
        authorizedRetailers[msg.sender] = true;
        emit RetailerUpdated(msg.sender, true);
    }

    // ------------------------------------------------------------------
    // Manufacturer functions
    // ------------------------------------------------------------------

    function setRetailer(address retailer, bool authorized) external onlyManufacturer {
        require(retailer != address(0), "Invalid retailer address");
        require(authorizedRetailers[retailer] != authorized, "Retailer already in that state");
        authorizedRetailers[retailer] = authorized;
        emit RetailerUpdated(retailer, authorized);
    }

    function voidWarranty(string calldata serial, string calldata reason)
        external
        onlyManufacturer
        warrantyExists(serial)
    {
        Warranty storage w = warranties[_key(serial)];
        require(!w.voided, "Warranty already voided");
        require(bytes(reason).length > 0, "Reason required");
        w.voided = true;
        emit WarrantyVoided(serial, reason);
    }

    function resolveClaim(uint256 claimId, bool approve) external onlyManufacturer {
        require(claimId > 0 && claimId <= totalClaims, "Claim not found");
        Claim storage c = claims[claimId];
        require(c.status == ClaimStatus.Pending, "Claim already resolved");

        c.status = approve ? ClaimStatus.Approved : ClaimStatus.Rejected;
        openClaims[_key(c.serialNumber)] -= 1;
        emit ClaimResolved(claimId, c.status);
    }

    // ------------------------------------------------------------------
    // Retailer functions
    // ------------------------------------------------------------------

    function issueWarranty(
        string calldata serial,
        string calldata productModel,
        address buyer,
        uint256 durationDays
    ) external onlyRetailer {
        uint256 serialLen = bytes(serial).length;
        require(serialLen >= 4 && serialLen <= 32, "Serial must be 4-32 characters");
        require(bytes(productModel).length > 0, "Product model required");
        require(buyer != address(0), "Invalid buyer address");
        require(buyer != msg.sender, "Retailer cannot be the buyer");
        require(durationDays > 0 && durationDays <= maxWarrantyDays, "Duration exceeds allowed range");

        bytes32 k = _key(serial);
        require(!warranties[k].exists, "Serial already registered");

        warranties[k] = Warranty({
            serialNumber: serial,
            productModel: productModel,
            holder: buyer,
            retailer: msg.sender,
            purchaseDate: block.timestamp,
            expiryDate: block.timestamp + durationDays * 1 days,
            transferCount: 0,
            voided: false,
            exists: true
        });
        _track(buyer, serial, k);
        totalWarranties++;

        emit WarrantyIssued(serial, buyer, msg.sender, block.timestamp + durationDays * 1 days);
    }

    // ------------------------------------------------------------------
    // Holder functions
    // ------------------------------------------------------------------

    function transferWarranty(string calldata serial, address newHolder) external warrantyExists(serial) {
        bytes32 k = _key(serial);
        Warranty storage w = warranties[k];
        require(msg.sender == w.holder, "Unauthorized: only the warranty holder");
        require(newHolder != address(0), "Invalid new holder address");
        require(newHolder != w.holder, "Already the holder");
        require(_isValid(w), "Warranty expired or voided");
        require(openClaims[k] == 0, "Resolve open claim before transfer");

        address previous = w.holder;
        w.holder = newHolder;
        w.transferCount++;
        _track(newHolder, serial, k);

        emit WarrantyTransferred(serial, previous, newHolder);
    }

    function fileClaim(string calldata serial, string calldata issue) external warrantyExists(serial) {
        bytes32 k = _key(serial);
        Warranty storage w = warranties[k];
        require(msg.sender == w.holder, "Unauthorized: only the warranty holder");
        require(_isValid(w), "Warranty expired or voided");
        uint256 issueLen = bytes(issue).length;
        require(issueLen >= 5 && issueLen <= 200, "Issue must be 5-200 characters");
        require(openClaims[k] < MAX_OPEN_CLAIMS, "A claim is already pending");

        totalClaims++;
        claims[totalClaims] = Claim({
            id: totalClaims,
            serialNumber: serial,
            issue: issue,
            claimant: msg.sender,
            filedAt: block.timestamp,
            status: ClaimStatus.Pending
        });
        claimIdsBySerial[k].push(totalClaims);
        openClaims[k] += 1;

        emit ClaimFiled(totalClaims, serial, msg.sender);
    }

    // ------------------------------------------------------------------
    // Read-only functions
    // ------------------------------------------------------------------

    function getWarranty(string calldata serial) external view warrantyExists(serial) returns (Warranty memory) {
        return warranties[_key(serial)];
    }

    function isWarrantyValid(string calldata serial) external view returns (bool) {
        Warranty storage w = warranties[_key(serial)];
        return w.exists && _isValid(w);
    }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        require(claimId > 0 && claimId <= totalClaims, "Claim not found");
        return claims[claimId];
    }

    function getClaimIds(string calldata serial) external view returns (uint256[] memory) {
        return claimIdsBySerial[_key(serial)];
    }

    /// @notice Serials currently held by `holder` (filters out ones transferred away).
    function getWarrantiesOf(address holder) external view returns (string[] memory) {
        string[] storage all = serialsByHolder[holder];
        uint256 count;
        for (uint256 i = 0; i < all.length; i++) {
            if (warranties[_key(all[i])].holder == holder) count++;
        }
        string[] memory result = new string[](count);
        uint256 j;
        for (uint256 i = 0; i < all.length; i++) {
            if (warranties[_key(all[i])].holder == holder) result[j++] = all[i];
        }
        return result;
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    function _key(string memory serial) internal pure returns (bytes32) {
        return keccak256(bytes(serial));
    }

    function _track(address holder, string calldata serial, bytes32 k) internal {
        if (!listedFor[holder][k]) {
            listedFor[holder][k] = true;
            serialsByHolder[holder].push(serial);
        }
    }

    function _isValid(Warranty storage w) internal view returns (bool) {
        return !w.voided && block.timestamp <= w.expiryDate;
    }
}
