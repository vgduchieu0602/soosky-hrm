export default interface PasswordHasher {
    hash(raw: string): Promise<string>;
    verify(raw: string, hash: string): Promise<boolean>;
}
