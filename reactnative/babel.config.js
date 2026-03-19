module.exports = {
  presets: [
    ["module:@react-native/babel-preset", { jsxImportSource: "nativewind" }],
    "nativewind/babel",
  ],
  plugins: [
    [
      "module:react-native-dotenv",
      {
        moduleName: "@env",
        path: ".env",
        allowUndefined: true,
      },
    ],
    "react-native-reanimated/plugin",
  ],
};