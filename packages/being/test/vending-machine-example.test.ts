import { createVendingMachine } from '../src/vending-machine-example';

describe('Vending Machine Example', () => {
    it('should create a vending machine and handle events', () => {
        const vendingMachine = createVendingMachine();
        vendingMachine.happens('insertBills');
        vendingMachine.happens('selectWater');
        vendingMachine.happens('cancelTransaction');
        expect(vendingMachine).toBeDefined();
    });
});
