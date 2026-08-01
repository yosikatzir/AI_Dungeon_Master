import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: ["data/**"],
  },
  {
    // Raw SQLite row-mapping layers: `any` is the pragmatic choice for
    // deserializing better-sqlite3 rows into our typed content/domain shapes.
    files: ["lib/content.ts", "lib/characters.ts", "lib/campaigns.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
