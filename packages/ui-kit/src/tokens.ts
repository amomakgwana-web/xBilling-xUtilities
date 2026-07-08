/**
 * Dark-industrial command-centre design tokens shared by xLayer, xBilling
 * and xUtilities. Ported from the original mockups so all three frontends
 * render as one visual system.
 */
export const T = {
  brand: "#F05A00", brandD: "#C44A00", brandL: "#FF7A2E", brandBg: "#1A0D00", brandRim: "#F05A0030",
  black: "#080808", g950: "#0D0D0D", g900: "#111", g800: "#161616",
  g700: "#1E1E1E", g600: "#252525", g500: "#333", g400: "#444",
  g300: "#666", g200: "#888", g100: "#AAA", g50: "#CCC",
  surf: "#1A1A1A", surf2: "#141414", surf3: "#0F0F0F",
  white: "#F0F0F0", white2: "rgba(255,255,255,.85)", white3: "rgba(255,255,255,.55)",
  white4: "rgba(255,255,255,.25)", white5: "rgba(255,255,255,.1)", white6: "rgba(255,255,255,.05)",
  green: "#22C55E", greenBg: "#052011", greenT: "#4ADE80", greenR: "#22C55E30",
  red: "#EF4444", redBg: "#1A0505", redT: "#FCA5A5", redR: "#EF444430",
  amber: "#F59E0B", amberBg: "#1A1000", amberT: "#FDE68A", amberR: "#F59E0B30",
  blue: "#3B82F6", blueBg: "#050E1A", blueT: "#93C5FD", blueR: "#3B82F630",
  purple: "#8B5CF6", purpleBg: "#0D0520", purpleT: "#C4B5FD", purpleR: "#8B5CF630",
  teal: "#14B8A6", tealBg: "#031210", tealT: "#99F6E4", tealR: "#14B8A630",
  cyan: "#06B6D4", cyanBg: "#03101A", cyanT: "#A5F3FC", cyanR: "#06B6D430",
  wa: "#25D366",
} as const;

export const fmtR = (n: number): string =>
  "R " + Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtN = (n: number): string => Number(n).toLocaleString("en-ZA");
