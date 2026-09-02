// Ambient test globals (describe / it / expect / beforeAll …). These used to
// come from @types/jest, which was still installed after the move to Vitest.
// Vitest ships its own declarations; referencing them here keeps every spec
// typed without narrowing `compilerOptions.types` (that would drop the
// Express `Request.user` augmentation).
/// <reference types="vitest/globals" />
