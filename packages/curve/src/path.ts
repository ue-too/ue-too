import { Line } from "./line";
import { Point } from "@ue-too/math";

export class Path {

    private lines: Line[];

    constructor(lines: Line[]){
        this.lines = lines;
    }

    append(line: Line): void{
        this.lines.push(line);
    }

    clear(): void{
        this.lines = [];
    }

    prepend(line: Line): void{
        this.lines.unshift(line);
    }

    getLines(): Line[]{
        return this.lines;
    }

    getLength(): number{
        let res = 0;
        this.lines.forEach((line)=>{
            res += line.length();
        });
        return res;
    }

    getPercentages(): {start: number, end: number}[]{
        const length = this.getLength();
        let currentCurvePercentage = 0;
        const res: {start: number, end: number}[] = [];
        this.lines.forEach((line)=>{
            const lineLength = line.length();
            const linePercentage = lineLength / length;
            let start = currentCurvePercentage;
            currentCurvePercentage += linePercentage;
            let end = currentCurvePercentage;
            res.push({start, end});
        });
        res[res.length - 1].end = 1;
        return res;
    }

    getPointByPercentage(percentage: number): Point | never{
        if (percentage < 0 || percentage > 1){
            throw new Error("Percentage must be between 0 and 1");
        }
        const percentages = this.getPercentages();
        let left = 0;
        let right = percentages.length - 1;
        while (left <= right){
            const mid = Math.floor((left + right) / 2);
            if (percentage < percentages[mid].end){
                right = mid - 1;
            } else if (percentage > percentages[mid].end){
                left = mid + 1;
            } else {
                left = mid;
                break;
            }
        }
        const line = this.lines[left];
        const linePercentage = percentages[left];
        const ratio = (percentage - linePercentage.start) / (linePercentage.end - linePercentage.start);
        return line.lerp(ratio);
    }
}
