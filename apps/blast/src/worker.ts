import { Coordinator } from "@ue-too/ecs";
import { StackableTokenSystem, LOCATION_COMPONENT } from "./token";

const coordinator = new Coordinator();
const deckSystem = new StackableTokenSystem(coordinator);

coordinator.registerComponent<{value: number}>('test');

console.log(coordinator.getComponentType('test'));

console.log(coordinator);

self.onmessage = (event) => {

    console.log(event.data);
};
