import { citizenName } from "@/lib/city/names";
import { pick, randInt, randRange } from "@/lib/city/rng";
import type { Building, Citizen, CitizenRole } from "@/lib/city/types";
import { lodgingUse } from "@/lib/city/lodging";
import { venueRole } from "@/lib/city/venues";

const ROLE_MIX: { role: CitizenRole; count: number }[] = [
  { role: "worker", count: 80 },
  { role: "family", count: 48 },
  { role: "shopper", count: 44 },
  { role: "student", count: 36 },
  { role: "tourist", count: 28 },
];

const ROLE_COLORS: Record<CitizenRole, string[]> = {
  worker: ["#2c4a7c", "#3d5a80", "#1f3a5c", "#4a5f7a"],
  family: ["#8a4b2f", "#6b3d2d", "#a36b3e", "#7a4e32"],
  shopper: ["#b03a6a", "#c45c4a", "#9b3d6e", "#d4787a"],
  student: ["#2a8a8a", "#3d7ec4", "#2f6f96", "#4aa3c4"],
  tourist: ["#c9a44c", "#e8c36a", "#d4782a", "#f0c36a"],
};

function ofKind(buildings: Building[], kinds: Building["kind"][]) {
  return buildings.filter((b) => kinds.includes(b.kind));
}

/**
 * Seeds the city with typed citizens and the destinations their daily loop needs.
 */
export function spawnCitizens(buildingMap: Map<string, Building>, rand: () => number): Citizen[] {
  const buildings = [...buildingMap.values()];
  const homes = buildings.filter(
    (b) => b.kind === "house" || b.kind === "apartment" || lodgingUse(b) === "residences",
  );
  const hotels = buildings.filter((b) => lodgingUse(b) === "hotel");
  const jobs = buildings.filter((b) =>
    ["office", "shop", "skyscraper", "tower", "hospital", "school", "police", "fire", "city_hall"].includes(
      b.kind,
    ),
  );
  const schools = ofKind(buildings, ["school"]);
  const shops = buildings.filter((b) => b.kind === "shop" && venueRole(b) !== "restaurant");
  const restaurants = buildings.filter((b) => venueRole(b) === "restaurant");
  const eateries = restaurants.length ? restaurants : ofKind(buildings, ["shop"]);
  const stores = shops.length ? shops : ofKind(buildings, ["shop"]);

  const citizens: Citizen[] = [];
  let i = 0;
  for (const { role, count } of ROLE_MIX) {
    for (let n = 0; n < count; n++) {
      const hotel = hotels.length ? hotels[i % hotels.length] : null;
      const home =
        role === "tourist"
          ? hotel ?? (homes.length ? pick(rand, homes) : null)
          : homes.length
            ? homes[i % homes.length]
            : null;
      const work = jobs.length ? jobs[i % jobs.length] : null;
      const school = schools.length ? schools[i % schools.length] : null;
      const shop = stores.length ? stores[i % stores.length] : null;
      const restaurant = eateries.length ? eateries[i % eateries.length] : null;
      const age =
        role === "student"
          ? randInt(rand, 14, 22)
          : role === "family"
            ? randInt(rand, 28, 48)
            : role === "worker"
              ? randInt(rand, 22, 64)
              : randInt(rand, 20, 72);

      citizens.push({
        id: `c${i}`,
        name: citizenName(rand),
        age,
        role,
        homeId: home?.id ?? null,
        workplaceId: role === "tourist" || role === "student" || role === "shopper" ? null : (work?.id ?? null),
        schoolId: role === "family" || role === "student" ? (school?.id ?? null) : null,
        shopId: role === "shopper" ? (shop?.id ?? null) : null,
        restaurantId: restaurant?.id ?? null,
        money: randInt(rand, 400, 9400),
        happiness: randInt(rand, 58, 94),
        health: randInt(rand, 62, 98),
        education: role === "student" ? randInt(rand, 50, 88) : randInt(rand, 40, 96),
        transport: pick(rand, ["walk", "walk", "walk", "car", "bus"]),
        x: home ? home.origin.x + 0.35 : randRange(rand, 14, 30),
        y: home ? home.origin.y + 0.35 : randRange(rand, 14, 30),
        path: [],
        pathIndex: 0,
        speed: randRange(rand, 1.35, 2.15),
        color: pick(rand, ROLE_COLORS[role]),
        activity: role === "tourist" ? "hotel" : "home",
      });
      i += 1;
    }
  }
  return citizens;
}
