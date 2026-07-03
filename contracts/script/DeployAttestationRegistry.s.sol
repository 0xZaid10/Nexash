// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";

contract DeployAttestationRegistry is Script {
    function run() external returns (AttestationRegistry registry) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.envOr("REGISTRY_OWNER", vm.addr(deployerKey));

        vm.startBroadcast(deployerKey);

        registry = new AttestationRegistry(owner);

        vm.stopBroadcast();

        console2.log("AttestationRegistry deployed at:", address(registry));
        console2.log("Owner:", owner);
    }
}
