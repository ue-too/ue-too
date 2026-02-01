import { Token } from '../token';

export function shuffle(tokens: number[]): number[] {
    const shuffled = [...tokens];
    for (let i = tokens.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
