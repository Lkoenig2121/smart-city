export function coverageRadius(kind: "police" | "fire" | "hospital") {
  switch (kind) {
    case "police":
      return 6;
    case "fire":
      return 7;
    case "hospital":
      return 8;
  }
}
