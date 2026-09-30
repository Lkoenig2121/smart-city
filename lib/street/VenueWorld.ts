import * as THREE from "three";
import type { Building, CityState } from "@/lib/city/types";
import { venueRole } from "@/lib/city/venues";
import { lightingFor } from "@/lib/renderer/palette";
import { InteriorControls, EYE_HEIGHT } from "./interiorControls";
import { buildVenueInterior, type VenueInterior } from "./venueInterior";
import { HeldItemView } from "./heldItem";
import { DutyUniformView } from "./dutyUniform";
import { TILE } from "./buildCity";

/** Half-width the office floor needs clear of neighbouring buildings (its walls sit at ±11). */
const OFFICE_CLEARANCE = 12.5;

export class VenueWorld {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: InteriorControls;
  readonly building: Building;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private interior: VenueInterior;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.PointLight;
  private heldView = new HeldItemView();
  private dutyView = new DutyUniformView();
  private mall: boolean;
  private onRoof = false;
  private outside = false;
  private cityScale = 1;
  private borrowedCity: THREE.Group | null = null;

  constructor(canvas: HTMLCanvasElement, private state: CityState, building: Building) {
    this.building = building;
    this.mall = venueRole(building) === "mall";
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.mall ? 1.42 : 1.05;
    this.renderer.shadowMap.enabled = true;

    this.camera = new THREE.PerspectiveCamera(74, 1, 0.1, this.mall ? 1400 : 80);
    this.scene.add(this.camera);
    this.heldView.attach(this.camera);
    this.dutyView.attach(this.camera);
    this.interior = buildVenueInterior(building, () => this.state);
    this.scene.add(this.interior.group);

    this.controls = new InteriorControls(
      this.interior.blockers,
      this.interior.groundAt,
      this.interior.bounds,
    );
    this.controls.spawn(
      this.interior.spawn.x,
      this.interior.spawn.z,
      this.interior.spawn.yaw,
      this.interior.spawn.pitch,
    );

    const night = this.isNight();
    this.hemi = new THREE.HemisphereLight(
      this.mall ? 0xf4f8fc : 0xfff1d6,
      this.mall ? 0xc5c8c2 : 0x3d4a3a,
      night ? (this.mall ? 1.05 : 0.75) : this.mall ? 1.55 : 1.15,
    );
    this.sun = new THREE.DirectionalLight(
      this.mall ? 0xf7fbff : 0xffe7c2,
      night ? (this.mall ? 0.72 : 0.45) : this.mall ? 1.65 : 1.25,
    );
    this.fill = new THREE.PointLight(
      this.mall ? 0xf2f7fb : 0xffe0b0,
      this.mall ? 70 : 22,
      this.mall ? 160 : 32,
      1.15,
    );
    this.sun.position.set(this.mall ? 70 : 6, this.mall ? 110 : 18, this.mall ? 48 : 8);
    if (this.mall) {
      this.sun.target.position.set(0, 6, 0);
      this.scene.add(this.sun.target);
    }
    this.fill.position.set(0, this.mall ? 20.4 : 4.2, this.mall ? 8 : 2);
    this.scene.add(this.hemi, this.sun, this.fill);
    if (this.mall) {
      const skylight = new THREE.DirectionalLight(0xffffff, night ? 0.35 : 0.85);
      skylight.position.set(0, 56, 0);
      const north = new THREE.PointLight(0xf4f8ff, 38, 120, 1.15);
      north.position.set(0, 18.2, -36);
      const south = new THREE.PointLight(0xf7fbff, 42, 120, 1.15);
      south.position.set(0, 17.8, 40);
      const west = new THREE.PointLight(0xeef4f8, 32, 100, 1.2);
      west.position.set(-40, 16.4, 0);
      const east = new THREE.PointLight(0xeef4f8, 32, 100, 1.2);
      east.position.set(40, 16.4, 0);
      const mid = new THREE.PointLight(0xffffff, 48, 90, 1.1);
      mid.position.set(0, 21.4, 0);
      const upper = new THREE.PointLight(0xf8fbff, 28, 80, 1.2);
      upper.position.set(0, 22.8, -8);
      this.scene.add(skylight, north, south, west, east, mid, upper);
      this.hemi.intensity = night ? 1.05 : 1.55;
      this.sun.intensity = night ? 0.72 : 1.65;
    }
    this.scene.background = new THREE.Color(night ? "#12151a" : this.mall ? "#7eb3e0" : "#1c1814");
    this.scene.environment = null;
    this.scene.fog = new THREE.Fog(
      night ? 0x12151a : this.mall ? 0x7eb3e0 : 0x1c1814,
      this.mall ? 140 : 16,
      this.mall ? 920 : 42,
    );
    if (this.mall) this.applySky();
  }

  attachCity(city: THREE.Group) {
    this.detachCity();
    if (this.interior.elevator) {
      // Office floors are wider than slim towers, so grow the streets until neighbours clear the glass.
      const halfW = Math.max(1, (this.building.width * TILE) / 2);
      const halfD = Math.max(1, (this.building.depth * TILE) / 2);
      this.cityScale = Math.max(1, OFFICE_CLEARANCE / halfW, OFFICE_CLEARANCE / halfD);
      city.scale.setScalar(this.cityScale);
      city.rotation.set(0, 0, 0);
      this.scene.add(city);
      this.borrowedCity = city;
      this.placeOfficeCity();
      return;
    }
    const halfW = Math.max(1, (this.building.width * TILE) / 2);
    const halfD = Math.max(1, (this.building.depth * TILE) / 2);
    const midX = (this.building.origin.x + this.building.width / 2) * TILE;
    const midZ = (this.building.origin.y + this.building.depth / 2) * TILE;
    // Interior glass sits at ±62. Scale the live streets so Harbor Mall's real
    // walls fall just outside that glass, then hide the mall shell so the view
    // is the road and buildings that actually sit on the other side.
    const scale = Math.max(63.6 / halfW, 63.6 / halfD);
    city.scale.setScalar(scale);
    city.position.set(-midX * scale, 0, -midZ * scale);
    city.rotation.set(0, 0, 0);
    city.traverse((obj) => {
      if (obj.userData.mallShell) obj.visible = false;
    });
    this.scene.add(city);
    this.borrowedCity = city;
  }

  detachCity() {
    const city = this.borrowedCity;
    if (city) {
      if (city.parent) city.parent.remove(city);
      city.position.set(0, 0, 0);
      city.rotation.set(0, 0, 0);
      city.scale.set(1, 1, 1);
      city.visible = true;
      city.traverse((obj) => {
        if (obj.userData.mallShell) obj.visible = true;
      });
    }
    this.borrowedCity = null;
    return city;
  }

  nearDesk() {
    return this.interior.nearDesk(this.controls.position.x, this.controls.position.z);
  }

  nearElevator() {
    return this.interior.elevator?.near(this.controls.position.x, this.controls.position.z) ?? false;
  }

  /** Floor buttons for the elevator panel, or null when this venue has no elevator. */
  elevatorMenu() {
    const elevator = this.interior.elevator;
    if (!elevator) return null;
    return { floors: elevator.floors, current: elevator.current(), desk: elevator.deskFloor };
  }

  /** Lines the borrowed streets up under the office floor the player is on, or hides them. */
  private placeOfficeCity() {
    const elevator = this.interior.elevator;
    const city = this.borrowedCity;
    if (!elevator || !city) return;
    const view = elevator.view(elevator.current());
    city.visible = view !== null;
    if (!view) return;
    const s = this.cityScale;
    const midX = (this.building.origin.x + this.building.width / 2) * TILE;
    const midZ = (this.building.origin.y + this.building.depth / 2) * TILE;
    city.position.set(-midX * s, -(view.height * s + view.lift), -midZ * s);
  }

  rideElevator(index: number) {
    const elevator = this.interior.elevator;
    if (!elevator) return;
    const stop = elevator.goTo(index);
    this.controls.clearKeys();
    this.controls.spawn(stop.x, stop.z, stop.yaw, 0);
    this.onRoof = elevator.isRoof(elevator.current());
    this.outside = elevator.view(elevator.current()) !== null;
    this.placeOfficeCity();
    this.camera.far = this.outside ? 1400 : 80;
    this.camera.updateProjectionMatrix();
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = this.outside ? 180 : 16;
      this.scene.fog.far = this.outside ? 1100 : 42;
    }
    if (this.outside) this.applySky();
    else {
      const night = this.isNight();
      const indoor = night ? "#12151a" : "#1c1814";
      if (this.scene.background instanceof THREE.Color) this.scene.background.set(indoor);
      if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.set(indoor);
    }
  }

  nearExit() {
    return this.interior.nearExit(
      this.controls.position.x,
      this.controls.position.z,
      this.controls.position.y - EYE_HEIGHT,
    );
  }

  nearStore() {
    return this.interior.nearStore?.(
      this.controls.position.x,
      this.controls.position.z,
      this.controls.position.y - EYE_HEIGHT,
    ) ?? null;
  }

  nearFurnish() {
    return this.interior.nearFurnish?.(
      this.controls.position.x,
      this.controls.position.z,
      this.controls.position.y - EYE_HEIGHT,
    ) ?? null;
  }

  nearSnack() {
    return this.interior.nearSnack?.(
      this.controls.position.x,
      this.controls.position.z,
      this.controls.position.y - EYE_HEIGHT,
    ) ?? null;
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  setHeld(id: string | null, sips = 0) {
    this.heldView.setHeld(id, sips);
  }

  setPoliceDuty(on: boolean) {
    this.dutyView.setOnDuty(on);
  }

  playSip() {
    this.heldView.playSip();
  }

  render(dt: number) {
    this.interior.update?.(dt);
    const ride = this.interior.rideAt?.(
      this.controls.position.x,
      this.controls.position.z,
      this.controls.position.y - EYE_HEIGHT,
    );
    if (ride) this.controls.nudge(ride.x * dt, ride.z * dt);
    this.controls.update(dt);
    this.controls.applyTo(this.camera);
    this.heldView.update(dt);
    this.dutyView.update(dt);
    const night = this.isNight();
    if (this.mall) {
      const light = lightingFor(this.state);
      this.sun.intensity = this.borrowedCity
        ? night
          ? 0.7
          : Math.max(1.85, light.sun * 2.5)
        : night
          ? 0.72
          : 1.65;
      this.sun.color.set(
        light.phase === "dawn" || light.phase === "dusk" ? "#ffb27a" : night ? "#b7cce8" : "#fff6e8",
      );
      this.hemi.intensity = night ? 1.05 : this.borrowedCity ? 1.35 : 1.55;
      this.fill.intensity = night ? 48 : 70;
      this.applySky();
    } else if (this.onRoof) {
      const light = lightingFor(this.state);
      this.sun.intensity = night ? 0.55 : Math.max(1.5, light.sun * 2.2);
      this.hemi.intensity = night ? 0.8 : 1.35;
      this.applySky();
    } else {
      this.sun.intensity = night ? 0.45 : 1.25;
      this.hemi.intensity = night ? 0.75 : 1.15;
      if (this.outside) this.applySky();
    }
    this.renderer.render(this.scene, this.camera);
  }

  private applySky() {
    const light = lightingFor(this.state);
    const night = this.isNight();
    const sky = night ? "#243656" : light.skyTop;
    if (this.scene.background instanceof THREE.Color) this.scene.background.set(sky);
    else this.scene.background = new THREE.Color(sky);
    this.scene.environment = null;
    const fog = night ? "#243656" : light.skyBottom;
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.set(fog);
  }

  private isNight() {
    const hour = this.state.clock.minuteOfDay / 60;
    return hour < 6.5 || hour >= 19.5;
  }

  dispose() {
    this.detachCity();
    this.heldView.dispose();
    this.dutyView.dispose();
    this.interior.dispose();
    this.renderer.dispose();
  }
}
