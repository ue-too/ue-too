export function calculateOrderOfMagnitude(value: number): number{
    if (value <= 0) return 0;
    let count = 0;
    if (value < 1) {
        let divisor = 1;
        while (divisor > value){
            divisor /= 10;
            count--;
        }
    } else {
        let divisor = 1;
        while (divisor * 10 <= value){
            divisor *= 10;
            count++;
        }
    }
    return count;
}
