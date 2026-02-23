export const getOffsets = (firstSectionOffset: number, numberOfRepeat: number, optionsLength: number, sectionOnTop: number): number[] => {
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

export const getOffset = (firstSectionOffset: number, section: number, numberOfRepeat: number, optionsLength: number, sectionOnTop: number): number => {
    if (sectionOnTop > numberOfRepeat || sectionOnTop < 0) {
        return 0;
    }

    if (sectionOnTop === 1) {
        return firstSectionOffset;
    }

    if (section >= sectionOnTop && section <= numberOfRepeat) {
        return firstSectionOffset - optionsLength * numberOfRepeat;
    }

    return firstSectionOffset;
}





