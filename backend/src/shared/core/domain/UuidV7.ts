/**
 * Tạo UUID v7 không phụ thuộc Node.js hay package ngoài để core module có thể
 * được tái sử dụng ở runtime khác. `random` có thể được truyền vào khi test.
 */
export default function createUuidV7(
    timestamp: number = Date.now(),
    random: () => number = Math.random,
): string {
    const milliseconds = Math.max(0, Math.floor(timestamp));
    const timeHex = milliseconds.toString(16).padStart(12, "0").slice(-12);
    const randomHex = (length: number): string => Array.from(
        { length },
        () => Math.floor(Math.min(Math.max(random(), 0), 0.9999999999999999) * 16).toString(16),
    ).join("");
    const variant = (8 + Math.floor(Math.min(Math.max(random(), 0), 0.9999999999999999) * 4)).toString(16);

    return `${timeHex.slice(0, 8)}-${timeHex.slice(8)}-7${randomHex(3)}-${variant}${randomHex(3)}-${randomHex(12)}`;
}
