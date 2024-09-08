import { DemoConfig } from "../types";
import { demoLovelaceDescription } from "./description";
import { demoEntitiesSections } from "./entities";
import { demoLovelaceSections } from "./lovelace";

export const demoSections: DemoConfig = {
  authorName: "Reverse",
  authorUrl: "https://github.com/home-assistant/frontend/",
  name: "Home Demo",
  description: demoLovelaceDescription,
  lovelace: demoLovelaceSections,
  entities: demoEntitiesSections,
  theme: () => ({}),
};
