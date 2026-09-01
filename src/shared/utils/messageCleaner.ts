export function cleanEmailMessage(rawText: string): string {
    if (!rawText) return "";

    let cleaned = rawText;

    // Common reply separators
    const replySeparators = [
        /On .* wrote:/i,
        /From: .*\nSent: .*\nTo: .*/i,
        /--- Original Message ---/i,
        /_{10,}/, // ______________
        /From:\s*"?.*"?\s*<.*@.*>/i
    ];

    for (const separator of replySeparators) {
        cleaned = cleaned.split(separator)[0];
    }

    // Remove quoted lines starting with >
    cleaned = cleaned
        .split("\n")
        .filter(line => !line.trim().startsWith(">"))
        .join("\n");

    // Remove extra blank lines
    cleaned = cleaned.replace(/\n\s*\n/g, "\n").trim();

    return cleaned;
}
