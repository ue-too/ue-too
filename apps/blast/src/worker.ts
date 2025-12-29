import { Coordinator, createGlobalComponentName } from "@ue-too/ecs";
import { StackableTokenSystem, LOCATION_COMPONENT } from "./token";

const coordinator = new Coordinator();
const deckSystem = new StackableTokenSystem(coordinator);

const TEST_COMPONENT = createGlobalComponentName('test');
coordinator.registerComponent<{value: number}>(TEST_COMPONENT);

console.log(coordinator.getComponentType(TEST_COMPONENT));

console.log(coordinator);

self.onmessage = (event) => {

    console.log(event.data);
};
