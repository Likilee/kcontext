import { noDependencies, type SheriffConfig } from "@softarc/sheriff-core";

export const sheriffConfig: SheriffConfig = {
  version: 1,
  entryPoints: {
    layout: "src/app/layout.tsx",
    home: "src/app/page.tsx",
  },
  enableBarrelLess: true,
  modules: {
    "src/domain": "layer:domain",
    "src/application": "layer:application",
    "src/infrastructure": "layer:infra",
    "src/components": "layer:ui",
    "src/lib": "layer:lib",
    "src/app": "layer:app",
  },
  depRules: {
    "layer:domain": noDependencies,
    "layer:application": ["layer:domain"],
    "layer:infra": ["layer:domain", "layer:application"],
    "layer:lib": ["layer:domain"],
    "layer:ui": ["layer:domain", "layer:application", "layer:lib"],
    "layer:app": [
      "layer:domain",
      "layer:application",
      "layer:infra",
      "layer:ui",
      "layer:lib",
    ],
    root: [
      "layer:domain",
      "layer:application",
      "layer:infra",
      "layer:ui",
      "layer:lib",
      "layer:app",
    ],
  },
};
