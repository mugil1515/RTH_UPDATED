import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

// ESLint's core `no-unused-vars` does not understand that `<Hero />` is a use of
// the imported `Hero`; that knowledge normally comes from eslint-plugin-react's
// `jsx-uses-vars`, which is not a dependency here. Without it every component
// and icon import in the project reported as unused — 96 warnings that buried
// the handful of genuinely dead bindings. This is that one rule, inline.
const jsx = {
  rules: {
    "uses-vars": {
      meta: { schema: [] },
      create(context) {
        const source = context.sourceCode ?? context.getSourceCode();
        const markUsed = (node, name) => {
          if (typeof source.markVariableAsUsed === "function") source.markVariableAsUsed(name, node);
        };
        return {
          JSXOpeningElement(node) {
            let name = node.name;
            while (name.type === "JSXMemberExpression") name = name.object;
            if (name.type === "JSXNamespacedName") name = name.namespace;
            if (name.type !== "JSXIdentifier") return;
            markUsed(node, name.name);
          },
        };
      },
    },
  },
};

export default [
  { ignores: ["dist", "existing-original", "reference", "output"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh, jsx },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "jsx/uses-vars": "error",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["scripts/**/*.{js,mjs}"],
    languageOptions: { globals: globals.node },
  },
];
