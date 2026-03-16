/**
 * Triggers a download of JSON data as a file.
 *
 * @param filename - Name of the file to download
 * @param data - Data to serialize as JSON
 */
export function downloadJson(filename: string, data: unknown): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Opens a file picker and invokes the callback with parsed JSON.
 *
 * @param onJson - Callback invoked with the parsed JSON (or on parse error, shows alert)
 */
export function uploadJson(onJson: (parsed: unknown) => void): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result as string);
                onJson(parsed);
            } catch (e) {
                alert(`Failed to parse JSON: ${(e as Error).message}`);
            }
        };
        reader.readAsText(file);
    });
    input.click();
}
