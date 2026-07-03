// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";

contract Configure is Script {
    function run() external {
        uint256 ownerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address registryAddress = vm.envAddress("ATTESTATION_REGISTRY_ADDRESS");
        address issuerAddress = vm.envAddress("NEXASH_ISSUER_ADDRESS");
        string memory issuerLabel = vm.envOr("NEXASH_ISSUER_LABEL", string("Nexash Hackathon Developer Issuer"));

        AttestationRegistry registry = AttestationRegistry(registryAddress);

        vm.startBroadcast(ownerKey);

        if (!registry.isIssuer(issuerAddress)) {
            registry.registerIssuer(issuerAddress, issuerLabel);
            console2.log("Registered issuer:", issuerAddress);
        } else {
            console2.log("Issuer already registered:", issuerAddress);
        }

        vm.stopBroadcast();
    }
}
