export const getOffset = (firstSectionOffset: number, numberOfRepeat: number, optionsLength: number, sectionOnTop: number): number[] => {
    if (sectionOnTop > numberOfRepeat || sectionOnTop < 0) {
        return [];
    }

    const offsets: number[] = [];

    for (let i = sectionOnTop; i < numberOfRepeat + 1; i++) {
        offsets.push(firstSectionOffset - optionsLength * numberOfRepeat);
    }

    for (let i = 0; i < sectionOnTop - 1; i++) {
        offsets.push(firstSectionOffset);
    }

    return offsets;
};



