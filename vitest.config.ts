import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `nix build` leaves a `result` symlink into the store, which contains its own
    // copy of every *.test.ts — exclude it so vitest doesn't run everything twice.
    exclude: [...configDefaults.exclude, "result/**"],
  },
});
