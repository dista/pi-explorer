import globals from "globals";
import babelParser from "@babel/eslint-parser";
import eslintPluginImport from "eslint-plugin-import";

export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
      parser: babelParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-env"], // Explicit ESM support
        },
      },
    },
    plugins: {
      import: eslintPluginImport,
    },
    rules: {},
  },
];
