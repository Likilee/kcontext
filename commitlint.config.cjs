const allowedTypes = [
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
];

module.exports = {
  ignores: [
    (message) =>
      message.startsWith("fixup!") ||
      message.startsWith("squash!") ||
      message.toLowerCase().startsWith("wip:"),
  ],
  rules: {
    "header-max-length": [2, "always", 100],
    "subject-empty": [2, "never"],
    "subject-case": [0],
    "type-empty": [2, "never"],
    "type-enum": [2, "always", allowedTypes],
  },
};
