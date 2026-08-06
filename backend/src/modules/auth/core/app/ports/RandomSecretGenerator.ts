/**
 * Cổng sinh chuỗi bí mật ngẫu nhiên.
 *
 * Core không quyết định nguồn entropy: host có thể dùng crypto của Node.js,
 * Web Crypto hay dịch vụ quản lý secret phù hợp với runtime đích.
 */
export default interface RandomSecretGenerator {
    generate(byteLength: number): string;
}
