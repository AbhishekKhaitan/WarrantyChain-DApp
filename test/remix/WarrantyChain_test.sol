// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Run in Remix: Solidity Unit Testing plugin -> select this file -> Run.
// Place it next to WarrantyChain.sol in the Remix workspace (or fix the import path).
import "remix_tests.sol";
import "../../contracts/WarrantyChain.sol";

/// Acts as a separate wallet so that "unauthorised caller" cases can be tested.
contract Actor {
    WarrantyChain public wc;
    constructor(WarrantyChain _wc) { wc = _wc; }

    function issue(string memory serial, address buyer) external {
        wc.issueWarranty(serial, "Model", buyer, 30);
    }
    function addRetailer(address r) external { wc.setRetailer(r, true); }
    function transfer(string memory serial, address to) external { wc.transferWarranty(serial, to); }
    function claim(string memory serial) external { wc.fileClaim(serial, "Screen flickers"); }
    function resolve(uint256 id) external { wc.resolveClaim(id, true); }
}

contract WarrantyChainTest {
    WarrantyChain wc;
    Actor stranger;   // has no role
    Actor customer;   // will hold warranties

    // This test contract deploys WarrantyChain, so it is the manufacturer
    // (and therefore also an authorised retailer).
    function beforeAll() public {
        wc = new WarrantyChain("Acme Electronics", 730);
        stranger = new Actor(wc);
        customer = new Actor(wc);
    }

    // ---------------- Valid ----------------

    function testConstructor() public {
        Assert.equal(wc.brandName(), "Acme Electronics", "brand");
        Assert.equal(wc.manufacturer(), address(this), "manufacturer");
        Assert.equal(wc.maxWarrantyDays(), 730, "max days");
        Assert.ok(wc.authorizedRetailers(address(this)), "manufacturer is retailer");
    }

    function testIssueWarranty() public {
        wc.issueWarranty("SN-1001", "Acme X200", address(customer), 365);
        WarrantyChain.Warranty memory w = wc.getWarranty("SN-1001");
        Assert.equal(w.holder, address(customer), "holder");
        Assert.equal(w.expiryDate - w.purchaseDate, 365 days, "duration");
        Assert.ok(wc.isWarrantyValid("SN-1001"), "valid");
        Assert.equal(wc.totalWarranties(), 1, "total");
    }

    function testFileAndResolveClaim() public {
        customer.claim("SN-1001");
        Assert.equal(wc.totalClaims(), 1, "claims");
        wc.resolveClaim(1, true);
        Assert.equal(uint256(wc.getClaim(1).status), uint256(WarrantyChain.ClaimStatus.Approved), "approved");
    }

    function testTransfer() public {
        customer.transfer("SN-1001", address(stranger));
        Assert.equal(wc.getWarranty("SN-1001").holder, address(stranger), "new holder");
    }

    // ---------------- Invalid ----------------

    function testDuplicateSerial() public {
        try wc.issueWarranty("SN-1001", "Acme X200", address(customer), 365) {
            Assert.ok(false, "should revert");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Serial already registered", reason);
        }
    }

    function testDurationTooLong() public {
        try wc.issueWarranty("SN-2002", "Acme X200", address(customer), 9999) {
            Assert.ok(false, "should revert");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Duration exceeds allowed range", reason);
        }
    }

    function testShortSerial() public {
        try wc.issueWarranty("SN", "Acme X200", address(customer), 30) {
            Assert.ok(false, "should revert");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Serial must be 4-32 characters", reason);
        }
    }

    function testZeroBuyer() public {
        try wc.issueWarranty("SN-3003", "Acme X200", address(0), 30) {
            Assert.ok(false, "should revert");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Invalid buyer address", reason);
        }
    }

    function testUnknownSerial() public {
        Assert.ok(!wc.isWarrantyValid("SN-NOPE"), "unknown serial is not valid");
    }

    // ---------------- Unauthorised ----------------

    function testStrangerCannotIssue() public {
        try stranger.issue("SN-4004", address(customer)) {
            Assert.ok(false, "should revert");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Unauthorized: not an authorized retailer", reason);
        }
    }

    function testStrangerCannotAddRetailer() public {
        try stranger.addRetailer(address(stranger)) {
            Assert.ok(false, "should revert");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Unauthorized: only manufacturer", reason);
        }
    }

    function testPreviousHolderCannotTransfer() public {
        // customer transferred SN-1001 to stranger in testTransfer
        try customer.transfer("SN-1001", address(customer)) {
            Assert.ok(false, "should revert");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Unauthorized: only the warranty holder", reason);
        }
    }

    function testNonOwnerCannotResolve() public {
        stranger.claim("SN-1001");
        try stranger.resolve(2) {
            Assert.ok(false, "should revert");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Unauthorized: only manufacturer", reason);
        }
    }
}
