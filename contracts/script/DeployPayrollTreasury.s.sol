// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PayrollTreasury} from "../src/PayrollTreasury.sol";

contract DeployPayrollTreasury is Script {
    function run() external returns (PayrollTreasury treasury) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.envOr("TREASURY_OWNER", vm.addr(deployerKey));
        address operator = vm.envOr("TREASURY_OPERATOR", owner);
        address registry = vm.envAddress("ATTESTATION_REGISTRY_ADDRESS");

        vm.startBroadcast(deployerKey);

        treasury = new PayrollTreasury(owner, registry, operator);

        vm.stopBroadcast();

        console2.log("PayrollTreasury deployed at:", address(treasury));
        console2.log("Owner:", owner);
        console2.log("Operator:", operator);
        console2.log("AttestationRegistry:", registry);
    }
}
