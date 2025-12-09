import { GenericEntityManager } from "./utils";

// 車輛 -> 編組 -> 車次

export type Car = {
    id: number;
    position: {
        trackNumber: number;
        tVal: number;
        extendPositionOnTrack: "positive" | "negative";
    };
    bogieOffsets: number[];
    formation: number;
};

export type Formation = {
    name: string;
    carsOrder: number[];
};

export class FormationCoordinator {

    private _formationManager: GenericEntityManager<Formation>;
    private _carManager: GenericEntityManager<Car>;

    constructor(formationManager: GenericEntityManager<Formation>, carManager: GenericEntityManager<Car>){
        this._formationManager = formationManager;
        this._carManager = carManager;
    }

    createNewFormation(name: string): number {
        return this._formationManager.createEntity({name, carsOrder: []});
    }

    removeFormation(formationNumber: number): boolean {
        const formation = this._formationManager.getEntity(formationNumber);
        if(formation == null){
            return true;
        }
        if(formation.carsOrder.length > 0){
            console.warn(`Formation ${formationNumber} is not empty, cannot remove`);
            return false;
        }
        this._formationManager.destroyEntity(formationNumber);
        return true;
    }

    appendCarToFormation(carNumber: number, formationNumber: number): boolean {
        const car = this._carManager.getEntity(carNumber);
        if(car == null){
            return false;
        }
        const formation = this._formationManager.getEntity(formationNumber);
        if(formation === null){
            return false;
        }
        formation.carsOrder.push(carNumber);
        car.formation = formationNumber;
        return true;
    }

    createNewFormationWithCars(carNumbers: number[], name: string = `Formation ${carNumbers.length}`): number | null{
        const cars = carNumbers.map(carNumber => this._carManager.getEntity(carNumber));
        if(cars.some(car => car === null)){
            return null;
        }
        const realCars = cars.filter(car => car !== null);
        const formationNumber = this.createNewFormation(name);
        realCars.forEach(car => {
            this.appendCarToFormation(car.id, formationNumber);
        });
        return formationNumber;
    }

}

class OneToManyIndex<A, B> {
  private aToB = new Map<A, B>();
  private bToAs = new Map<B, Set<A>>();

  set(a: A, b: B) {
    // If a was previously assigned to a different b, unlink it
    const prevB = this.aToB.get(a);
    if (prevB !== undefined && prevB !== b) {
      const set = this.bToAs.get(prevB);
      if (set) {
        set.delete(a);
        if (set.size === 0) this.bToAs.delete(prevB);
      }
    }

    // Link a -> b
    this.aToB.set(a, b);

    // Link b -> a (add to set)
    let set = this.bToAs.get(b);
    if (!set) {
      set = new Set<A>();
      this.bToAs.set(b, set);
    }
    set.add(a);
  }

  getB(a: A): B | undefined {
    return this.aToB.get(a);
  }

  getAs(b: B): ReadonlySet<A> | undefined {
    return this.bToAs.get(b);
  }

  deleteA(a: A): boolean {
    const b = this.aToB.get(a);
    if (b === undefined) return false;
    this.aToB.delete(a);
    const set = this.bToAs.get(b);
    if (set) {
      set.delete(a);
      if (set.size === 0) this.bToAs.delete(b);
    }
    return true;
  }

  deleteB(b: B): boolean {
    const set = this.bToAs.get(b);
    if (!set) return false;
    for (const a of set) this.aToB.delete(a);
    this.bToAs.delete(b);
    return true;
  }

  clear() {
    this.aToB.clear();
    this.bToAs.clear();
  }
}
