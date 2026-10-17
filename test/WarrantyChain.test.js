const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("WarrantyChain", function () {
  let wc, manufacturer, retailer, buyer, buyer2, stranger;
  const SERIAL = "SN-1001";

  beforeEach(async function () {
    [manufacturer, retailer, buyer, buyer2, stranger] = await ethers.getSigners();
    const F = await ethers.getContractFactory("WarrantyChain");
    wc = await F.deploy("Acme Electronics", 730);
    await wc.setRetailer(retailer.address, true);
  });

  async function issue(serial = SERIAL, days = 365) {
    return wc.connect(retailer).issueWarranty(serial, "Acme X200 Laptop", buyer.address, days);
  }

  // -------------------------------------------------------------------------
  describe("Constructor", function () {
    it("V1: sets brand, manufacturer, max days and authorises the manufacturer", async function () {
      expect(await wc.brandName()).to.equal("Acme Electronics");
      expect(await wc.manufacturer()).to.equal(manufacturer.address);
      expect(await wc.maxWarrantyDays()).to.equal(730);
      expect(await wc.authorizedRetailers(manufacturer.address)).to.equal(true);
    });

    it("I1: rejects empty brand name", async function () {
      const F = await ethers.getContractFactory("WarrantyChain");
      await expect(F.deploy("", 365)).to.be.revertedWith("Brand name required");
    });

    it("I2: rejects max warranty of 0 or > 3650 days", async function () {
      const F = await ethers.getContractFactory("WarrantyChain");
      await expect(F.deploy("Acme", 0)).to.be.revertedWith("Max warranty must be 1-3650 days");
      await expect(F.deploy("Acme", 4000)).to.be.revertedWith("Max warranty must be 1-3650 days");
    });
  });

  // -------------------------------------------------------------------------
  describe("Valid inputs", function () {
    it("V2: manufacturer authorises a retailer", async function () {
      await expect(wc.setRetailer(stranger.address, true))
        .to.emit(wc, "RetailerUpdated").withArgs(stranger.address, true);
      expect(await wc.authorizedRetailers(stranger.address)).to.equal(true);
    });

    it("V3: retailer issues a warranty and data is retrievable", async function () {
      await expect(issue()).to.emit(wc, "WarrantyIssued");
      const w = await wc.getWarranty(SERIAL);
      expect(w.serialNumber).to.equal(SERIAL);
      expect(w.productModel).to.equal("Acme X200 Laptop");
      expect(w.holder).to.equal(buyer.address);
      expect(w.retailer).to.equal(retailer.address);
      expect(w.expiryDate - w.purchaseDate).to.equal(365n * 86400n);
      expect(await wc.isWarrantyValid(SERIAL)).to.equal(true);
      expect(await wc.totalWarranties()).to.equal(1);
      expect(await wc.getWarrantiesOf(buyer.address)).to.deep.equal([SERIAL]);
    });

    it("V4: holder transfers the warranty to a new owner", async function () {
      await issue();
      await expect(wc.connect(buyer).transferWarranty(SERIAL, buyer2.address))
        .to.emit(wc, "WarrantyTransferred").withArgs(SERIAL, buyer.address, buyer2.address);
      const w = await wc.getWarranty(SERIAL);
      expect(w.holder).to.equal(buyer2.address);
      expect(w.transferCount).to.equal(1);
      expect(await wc.getWarrantiesOf(buyer.address)).to.deep.equal([]);
      expect(await wc.getWarrantiesOf(buyer2.address)).to.deep.equal([SERIAL]);
    });

    it("V5: holder files a claim and manufacturer approves it", async function () {
      await issue();
      await expect(wc.connect(buyer).fileClaim(SERIAL, "Screen flickers"))
        .to.emit(wc, "ClaimFiled").withArgs(1, SERIAL, buyer.address);
      expect(await wc.openClaims(ethers.keccak256(ethers.toUtf8Bytes(SERIAL)))).to.equal(1);
      await expect(wc.resolveClaim(1, true)).to.emit(wc, "ClaimResolved").withArgs(1, 1);
      const c = await wc.getClaim(1);
      expect(c.status).to.equal(1); // Approved
      expect(await wc.getClaimIds(SERIAL)).to.deep.equal([1n]);
    });

    it("V6: manufacturer voids a counterfeit warranty", async function () {
      await issue();
      await expect(wc.voidWarranty(SERIAL, "Counterfeit unit")).to.emit(wc, "WarrantyVoided");
      expect(await wc.isWarrantyValid(SERIAL)).to.equal(false);
    });

    it("V7: warranty becomes invalid after expiry", async function () {
      await issue(SERIAL, 30);
      await time.increase(31 * 86400);
      expect(await wc.isWarrantyValid(SERIAL)).to.equal(false);
    });
  });

  // -------------------------------------------------------------------------
  describe("Invalid inputs", function () {
    it("I3: duplicate serial number", async function () {
      await issue();
      await expect(issue()).to.be.revertedWith("Serial already registered");
    });

    it("I4: serial too short / too long", async function () {
      await expect(issue("SN1")).to.be.revertedWith("Serial must be 4-32 characters");
      await expect(issue("X".repeat(33))).to.be.revertedWith("Serial must be 4-32 characters");
    });

    it("I5: empty product model", async function () {
      await expect(wc.connect(retailer).issueWarranty(SERIAL, "", buyer.address, 365))
        .to.be.revertedWith("Product model required");
    });

    it("I6: zero buyer address and retailer buying from itself", async function () {
      await expect(wc.connect(retailer).issueWarranty(SERIAL, "X200", ethers.ZeroAddress, 365))
        .to.be.revertedWith("Invalid buyer address");
      await expect(wc.connect(retailer).issueWarranty(SERIAL, "X200", retailer.address, 365))
        .to.be.revertedWith("Retailer cannot be the buyer");
    });

    it("I7: duration 0 or above maximum", async function () {
      await expect(issue(SERIAL, 0)).to.be.revertedWith("Duration exceeds allowed range");
      await expect(issue(SERIAL, 731)).to.be.revertedWith("Duration exceeds allowed range");
    });

    it("I8: unknown serial lookup", async function () {
      await expect(wc.getWarranty("SN-9999")).to.be.revertedWith("Warranty not found");
      expect(await wc.isWarrantyValid("SN-9999")).to.equal(false);
    });

    it("I9: claim description too short", async function () {
      await issue();
      await expect(wc.connect(buyer).fileClaim(SERIAL, "bad")).to.be.revertedWith("Issue must be 5-200 characters");
    });

    it("I10: second claim while one is pending, and transfer while claim is open", async function () {
      await issue();
      await wc.connect(buyer).fileClaim(SERIAL, "Battery drains fast");
      await expect(wc.connect(buyer).fileClaim(SERIAL, "Keyboard broken")).to.be.revertedWith("A claim is already pending");
      await expect(wc.connect(buyer).transferWarranty(SERIAL, buyer2.address))
        .to.be.revertedWith("Resolve open claim before transfer");
    });

    it("I11: claim on an expired warranty", async function () {
      await issue(SERIAL, 30);
      await time.increase(31 * 86400);
      await expect(wc.connect(buyer).fileClaim(SERIAL, "Screen flickers")).to.be.revertedWith("Warranty expired or voided");
    });

    it("I12: claim on a voided warranty / void twice", async function () {
      await issue();
      await wc.voidWarranty(SERIAL, "Counterfeit unit");
      await expect(wc.connect(buyer).fileClaim(SERIAL, "Screen flickers")).to.be.revertedWith("Warranty expired or voided");
      await expect(wc.voidWarranty(SERIAL, "again")).to.be.revertedWith("Warranty already voided");
    });

    it("I13: resolving a non-existent or already resolved claim", async function () {
      await expect(wc.resolveClaim(5, true)).to.be.revertedWith("Claim not found");
      await issue();
      await wc.connect(buyer).fileClaim(SERIAL, "Screen flickers");
      await wc.resolveClaim(1, false);
      await expect(wc.resolveClaim(1, true)).to.be.revertedWith("Claim already resolved");
    });

    it("I14: transfer to zero address or to self", async function () {
      await issue();
      await expect(wc.connect(buyer).transferWarranty(SERIAL, ethers.ZeroAddress)).to.be.revertedWith("Invalid new holder address");
      await expect(wc.connect(buyer).transferWarranty(SERIAL, buyer.address)).to.be.revertedWith("Already the holder");
    });
  });

  // -------------------------------------------------------------------------
  describe("Unauthorised access", function () {
    it("U1: non-retailer cannot issue a warranty", async function () {
      await expect(wc.connect(stranger).issueWarranty(SERIAL, "X200", buyer.address, 365))
        .to.be.revertedWith("Unauthorized: not an authorized retailer");
    });

    it("U2: revoked retailer can no longer issue", async function () {
      await wc.setRetailer(retailer.address, false);
      await expect(issue()).to.be.revertedWith("Unauthorized: not an authorized retailer");
    });

    it("U3: non-manufacturer cannot authorise retailers", async function () {
      await expect(wc.connect(retailer).setRetailer(stranger.address, true))
        .to.be.revertedWith("Unauthorized: only manufacturer");
    });

    it("U4: non-holder cannot transfer someone else's warranty", async function () {
      await issue();
      await expect(wc.connect(stranger).transferWarranty(SERIAL, stranger.address))
        .to.be.revertedWith("Unauthorized: only the warranty holder");
    });

    it("U5: previous holder cannot file claims after transfer", async function () {
      await issue();
      await wc.connect(buyer).transferWarranty(SERIAL, buyer2.address);
      await expect(wc.connect(buyer).fileClaim(SERIAL, "Screen flickers"))
        .to.be.revertedWith("Unauthorized: only the warranty holder");
    });

    it("U6: non-manufacturer cannot resolve claims or void warranties", async function () {
      await issue();
      await wc.connect(buyer).fileClaim(SERIAL, "Screen flickers");
      await expect(wc.connect(buyer).resolveClaim(1, true)).to.be.revertedWith("Unauthorized: only manufacturer");
      await expect(wc.connect(retailer).voidWarranty(SERIAL, "fraud")).to.be.revertedWith("Unauthorized: only manufacturer");
    });
  });
});
