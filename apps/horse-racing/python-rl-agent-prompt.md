# Prompt: Create Horse Racing RL Python Repository

Create a new Python repository for training reinforcement learning multi-agents to control jockeys in a horse racing simulation. This Python environment reimplements a TypeScript simulation that runs in the browser, so the physics must match exactly for validation.

## Repository Setup

- Name: `horse-racing-rl` (or similar)
- Use `uv` for project/dependency management with `pyproject.toml`
- Python 3.11+
- Key dependencies: `gymnasium`, `pettingzoo`, `numpy`, `stable-baselines3`, `ray[rllib]` (optional), `supersuit`, `pytest`, `httpx` (for validation client)

## Repository Structure

```
horse-racing-rl/
├── pyproject.toml
├── README.md
├── horse_racing/
│   ├── __init__.py
│   ├── types.py                # TrackSegment types, shared data structures
│   ├── track.py                # Track JSON parsing
│   ├── track_navigator.py      # Port of TrackNavigator class
│   ├── physics.py              # Simple 2D physics (integration + collision)
│   ├── engine.py               # HorseRacingEngine — core simulation
│   ├── attributes.py           # CoreAttributes, EffectiveAttributes, trait ranges, modifier resolution
│   ├── genome.py               # HorseGenome, Gene, Allele types, expression, breeding
│   ├── modifiers.py            # ModifierDefinition registry, condition functions, 8 built-in modifiers
│   ├── stamina.py              # Stamina depletion/recovery logic with cornering threshold
│   ├── env.py                  # Single-agent Gymnasium env wrapper
│   ├── multi_agent_env.py      # PettingZoo ParallelEnv for multi-agent
│   ├── reward.py               # Reward function module
│   └── validation.py           # Trajectory comparison against JS server
├── tracks/                     # Track JSON files (copy from JS repo)
│   ├── exp_track_8.json
│   └── ...
├── tests/
│   ├── test_track.py
│   ├── test_track_navigator.py
│   ├── test_engine.py
│   ├── test_attributes.py
│   ├── test_genome.py
│   ├── test_env.py
│   └── test_validation.py
└── scripts/
    ├── train.py                # Training entry point
    └── validate.py             # Run validation against JS server
```

## Simulation Specification

### Track Data Format

Tracks are JSON arrays of segments. Each segment is either STRAIGHT or CURVE:

```python
@dataclass
class StraightSegment:
    tracktype: Literal["STRAIGHT"]
    start_point: tuple[float, float]  # (x, y)
    end_point: tuple[float, float]

@dataclass
class CurveSegment:
    tracktype: Literal["CURVE"]
    start_point: tuple[float, float]
    end_point: tuple[float, float]
    center: tuple[float, float]
    radius: float
    angle_span: float  # radians, positive = CCW, negative = CW
```

Track JSON uses camelCase keys (`startPoint`, `endPoint`, `tracktype`, `angleSpan`). Parse accordingly.

### Physics Constants (global, not per-horse)

```python
HORSE_COUNT = 4
HORSE_RADIUS = 9
HORSE_SPACING = 14

PHYS_HZ = 240          # physics timestep = 1/240 s
PHYS_SUBSTEPS = 8       # substeps per game tick

NORMAL_DAMP = 0.5       # radial velocity damping coefficient

TRACK_HALF_WIDTH = HORSE_SPACING * HORSE_COUNT + HORSE_RADIUS  # = 65

# Stamina constants
STAMINA_DRAIN_RATE = 0.1       # drain per unit of extra tangential accel per tick
OVERDRIVE_DRAIN_RATE = 0.05    # drain per unit of speed above cruise per tick
CORNERING_DRAIN_RATE = 0.02    # drain per unit of excess cornering force per tick
GRIP_FORCE_BASELINE = 150.0    # base force tolerance, scaled by corneringGrip
```

### Per-Horse Attributes System

Instead of global constants like `HORSE_MASS` or `TANGENTIAL_TARGET_SPEED`, each horse has individual attributes derived from its genome. The simulation reads `EffectiveAttributes` (base + modifiers) per horse each tick.

#### Core Attributes (8 traits)

| Trait | Default | Range | Description |
|---|---|---|---|
| `cruise_speed` | 13.0 | 8–18 | Speed the horse naturally settles to without jockey input |
| `max_speed` | 20.0 | 15–25 | Absolute speed ceiling |
| `forward_accel` | 1.0 | 0.5–1.5 | Multiplier on jockey's tangential input |
| `turn_accel` | 1.0 | 0.5–1.5 | Multiplier on jockey's normal (steering) input |
| `cornering_grip` | 1.0 | 0.5–1.5 | Defines stamina drain threshold for cornering (does NOT affect centripetal physics force) |
| `stamina` | 100.0 | 50–150 | Max energy pool |
| `stamina_recovery` | 1.0 | 0.5–2.0 | Energy recovery per tick when not pushing |
| `weight` | 500.0 | 400–600 | Mass in kg (affects F=ma and collision impulse) |

```python
@dataclass
class CoreAttributes:
    cruise_speed: float = 13.0
    max_speed: float = 20.0
    forward_accel: float = 1.0
    turn_accel: float = 1.0
    cornering_grip: float = 1.0
    stamina: float = 100.0
    stamina_recovery: float = 1.0
    weight: float = 500.0

TRAIT_RANGES: dict[str, tuple[float, float]] = {
    "cruise_speed": (8.0, 18.0),
    "max_speed": (15.0, 25.0),
    "forward_accel": (0.5, 1.5),
    "turn_accel": (0.5, 1.5),
    "cornering_grip": (0.5, 1.5),
    "stamina": (50.0, 150.0),
    "stamina_recovery": (0.5, 2.0),
    "weight": (400.0, 600.0),
}
```

#### Genome → Base Attributes

Each gene has two alleles [0, 1] (one from sire, one from dam). Core traits use blending expression:

```python
@dataclass
class Gene:
    sire: float  # [0, 1]
    dam: float   # [0, 1]

@dataclass
class HorseGenome:
    core: dict[str, Gene]       # one gene per core trait
    modifiers: dict[str, tuple[Gene, Gene]]  # (presence_gene, strength_gene) per modifier

def express_core_trait(gene: Gene, trait_range: tuple[float, float]) -> float:
    expressed = gene.sire * 0.5 + gene.dam * 0.5
    min_val, max_val = trait_range
    return min_val + expressed * (max_val - min_val)

def express_genome(genome: HorseGenome) -> CoreAttributes:
    attrs = {}
    for trait, gene in genome.core.items():
        attrs[trait] = express_core_trait(gene, TRAIT_RANGES[trait])
    return CoreAttributes(**attrs)
```

#### Breeding

```python
def breed_gene(sire_gene: Gene, dam_gene: Gene, mutation_rate: float = 0.05) -> Gene:
    from_sire = sire_gene.sire if random() < 0.5 else sire_gene.dam
    from_dam = dam_gene.sire if random() < 0.5 else dam_gene.dam

    def mutate(v: float) -> float:
        if random() < mutation_rate:
            return max(0.0, min(1.0, v + (random() - 0.5) * 0.1))
        return v

    return Gene(sire=mutate(from_sire), dam=mutate(from_dam))
```

#### Modifier Traits (8 built-in)

Each horse has a subset of modifiers (determined by genome). Each modifier has a condition, target trait(s), and effect type.

| Modifier | Condition | Affects | Effect | Description |
|---|---|---|---|---|
| `drafting` | Within 15 units behind another horse | `cruise_speed` | +pct 2–8% | Aerodynamic benefit |
| `pack_pressure` | ≥2 horses within 20 units | `forward_accel` | +pct 3–10% | Competitive instinct |
| `pack_anxiety` | ≥3 horses within 10 units | `turn_accel` | -pct 5–15% | Nervous in tight spaces |
| `front_runner` | In 1st place | `cruise_speed` | +flat 0.5–1.5 | Performs better leading |
| `closer` | In last 25% of track AND not 1st | `max_speed` | +pct 3–8% | Closing kick |
| `mudder` | Track surface = wet/heavy | `cornering_grip` | +pct 5–15% | Handles wet conditions |
| `gate_speed` | First 10% of track | `forward_accel` | +pct 10–25% | Explosive starts |
| `endurance` | `current_stamina` < 40% | `stamina_recovery` | +pct 10–30% | Recovers better when tired |

A modifier is present if `max(presence_gene.sire, presence_gene.dam) >= 0.4`. Its strength (0–1) is the blended average of the strength gene's alleles, which scales the effect within the listed range.

#### Modifier Resolution

```python
def resolve_effective(base: CoreAttributes, active_modifiers: list[ActiveModifier]) -> CoreAttributes:
    flat_bonuses: dict[str, float] = defaultdict(float)
    pct_bonuses: dict[str, float] = defaultdict(float)

    for mod in active_modifiers:
        defn = MODIFIER_REGISTRY[mod.id]
        for effect in defn.effects:
            if effect.flat:
                flat_bonuses[effect.target] += effect.flat * mod.strength
            if effect.pct:
                pct_bonuses[effect.target] += effect.pct * mod.strength

    result = {}
    for trait in TRAIT_RANGES:
        base_val = getattr(base, trait)
        effective = (base_val + flat_bonuses[trait]) * (1.0 + pct_bonuses[trait])
        min_val, max_val = TRAIT_RANGES[trait]
        result[trait] = max(min_val, min(max_val, effective))

    return CoreAttributes(**result)
```

#### Stamina System

```python
@dataclass
class HorseRuntimeState:
    current_stamina: float
    base_attributes: CoreAttributes
    active_modifiers: list[ActiveModifier]

def update_stamina(state: HorseRuntimeState, eff: CoreAttributes,
                   extra_tangential: float, current_speed: float,
                   tangential_vel: float, turn_radius: float) -> float:
    drain = 0.0

    # Drain from jockey pushing forward
    if extra_tangential > 0:
        drain += abs(extra_tangential) * STAMINA_DRAIN_RATE

    # Drain from exceeding cruise speed
    if current_speed > eff.cruise_speed:
        drain += (current_speed - eff.cruise_speed) * OVERDRIVE_DRAIN_RATE

    # Drain from cornering beyond grip threshold
    if turn_radius < 1e6:
        required_force = tangential_vel ** 2 / turn_radius
        tolerated_force = eff.cornering_grip * GRIP_FORCE_BASELINE
        if required_force > tolerated_force:
            drain += (required_force - tolerated_force) * CORNERING_DRAIN_RATE

    # Recovery (only when not draining)
    if drain == 0:
        recovery = eff.stamina_recovery
        state.current_stamina = min(eff.stamina, state.current_stamina + recovery)
    else:
        state.current_stamina = max(0, state.current_stamina - drain)

    return state.current_stamina

def apply_exhaustion(eff: CoreAttributes, current_stamina: float, max_stamina: float) -> CoreAttributes:
    ratio = current_stamina / max_stamina
    result = CoreAttributes(**{k: getattr(eff, k) for k in TRAIT_RANGES})
    if ratio < 0.30:
        result.forward_accel *= (ratio / 0.30)  # gradual degradation
    if ratio < 0.20:
        lerp = ratio / 0.20
        result.max_speed = result.cruise_speed + (result.max_speed - result.cruise_speed) * lerp
    if ratio < 0.15:
        result.turn_accel *= 0.75
    return result
```

### TrackNavigator (port from TypeScript)

The `TrackNavigator` tracks which segment a horse is on and computes the local frame of reference.

**Frame computation:**
- **Straight segments**: `tangential` = unit vector from startPoint to endPoint. `normal` = tangential rotated -90° (points outward/right). `turnRadius = Infinity`. `targetRadius = Infinity`.
- **Curve segments**: `normal` = unit vector from center to horse position (points outward). `tangential` = normal rotated +90° if angleSpan >= 0 (CCW), else -90° (CW). `turnRadius` = distance from center to horse. `targetRadius` = radius when horse entered this curve (captured on first frame or segment transition), clamped to `>= radius - halfTrackWidth`.

**Segment transitions:**
- **Straight exit**: horse exits when dot product of (position - endPoint) with forward direction > 0
- **Curve exit**: horse exits when the signed angle from the end direction to the horse direction crosses zero (positive for CCW spans, negative for CW)
- On transition to a new curve: if coming from another curve, carry lane offset (`entryRadius - prevSegment.radius`). If coming from a straight, capture actual distance from curve center. Always clamp to `>= newSegment.radius - halfTrackWidth`.

### Force Model (per horse, per tick)

This is the core physics. It uses per-horse `EffectiveAttributes` (after modifier resolution and exhaustion) instead of global constants:

```python
def compute_forces(velocity, track_frame, action, eff: CoreAttributes):
    tangential_vel = dot(velocity, frame.tangential)
    normal_vel = dot(velocity, frame.normal)

    # Centripetal acceleration (only on curves)
    # Uses actual turn_radius (horse's distance from curve center).
    # NOT scaled by cornering_grip — centripetal force is a physical
    # constraint for circular motion. corneringGrip only affects stamina drain.
    centripetal = (tangential_vel ** 2) / frame.turn_radius if frame.turn_radius < 1e6 else 0

    # Auto-cruise toward target speed (uses per-horse cruise_speed)
    speed_change = eff.cruise_speed - tangential_vel
    extra_tangential = action.extra_tangential * eff.forward_accel  # scaled by horse's accel trait
    extra_normal = action.extra_normal * eff.turn_accel             # scaled by horse's turn trait

    tangential_accel = speed_change + extra_tangential
    if tangential_vel >= eff.max_speed and tangential_accel > 0:
        tangential_accel = 0

    normal_accel = (
        -centripetal
        - normal_vel * NORMAL_DAMP
        + extra_normal
    )

    total_accel = tangential_accel * frame.tangential + normal_accel * frame.normal
    total_force = total_accel * eff.weight  # F = ma, uses per-horse weight
    return total_force
```

**Per-tick pipeline:**
1. Resolve effective attributes: `base_attrs → apply modifiers → apply exhaustion → EffectiveAttributes` (once per tick, before substeps)
2. Update stamina (once per tick)
3. For each physics substep (8 per tick):
   a. Recompute track frame from current horse position
   b. Recompute forces using current velocity and track frame
   c. Apply force to horse
   d. Run physics step (integration + collision)
   e. Force is cleared after each step, which is why it must be reapplied every substep
4. Update navigators, build observations

### Physics Integration

The JS engine uses `useLinearCollisionResolution = true`, meaning no angular dynamics. Each substep:

1. Recompute track frame and forces from current state (see Force Model above)
2. Apply force to body
3. Integrate: `velocity += (force / mass) * dt`, then `position += velocity * dt`
4. Resolve collisions (position-only correction, no angular impulse)
5. Clear forces (force is zeroed after each step — this is why forces MUST be reapplied every substep)

**IMPORTANT:** Forces are cleared after each `world.step()` call. If you apply force once and step 8 times, only the first substep receives the force. You must recompute and reapply forces before every substep. This is critical for correct centripetal behavior on curves.

The `dt` for each substep is `1 / PHYS_HZ` (= 1/240 s). There are `PHYS_SUBSTEPS = 8` substeps per game tick.

Auto-orient horse to face tangential direction (each substep):
```python
orientation = atan2(frame.tangential.y, frame.tangential.x)
```

### Collision Geometry

Static colliders (track walls):
- **Straight segments**: Two rectangular polygons (inner + outer rail) at `centerline ± (halfTrackWidth + railThickness/2)`, where `railThickness = 3`
- **Curve segments**: Inner rail is a Crescent shape at `radius - halfTrackWidth`. Outer rail is a series of small quadrilateral polygon strips at `radius + halfTrackWidth` to `radius + halfTrackWidth + railThickness`, stepped every 5°.

Dynamic colliders:
- **Horses**: Circles with radius 9, mass 500

For the Python port, you can simplify collision detection since there are few bodies:
- Circle-vs-line-segment for straight rails
- Circle-vs-arc for curve inner rails
- Circle-vs-circle for horse-horse
- Push-out resolution (move circle out of overlap along collision normal, adjust velocity)

### Horse Starting Positions

Horses line up at the start of the first track segment, offset outward from the centerline:
```python
for i in range(HORSE_COUNT):
    position = start_origin + outward_direction * HORSE_SPACING * (i + 1)
```
Where `start_origin` is the first segment's startPoint, and `outward_direction` is the forward direction rotated -90°.

## Gymnasium Environment

### Action Space

```python
# Continuous, per horse
action_space = spaces.Box(
    low=np.array([-10.0, -5.0]),    # [extra_tangential, extra_normal]
    high=np.array([10.0, 5.0]),
    dtype=np.float32
)
```

### Observation Space

```python
# Per horse, 15 dimensions
observation_space = spaces.Box(
    low=-np.inf, high=np.inf,
    shape=(15,), dtype=np.float32
)
# [0]  tangential_vel          — speed along track direction
# [1]  normal_vel              — lateral speed
# [2]  displacement            — lane offset (turnRadius - targetRadius)
# [3]  track_progress          — fraction [0, 1] along total track length
# [4]  curvature               — 1/turnRadius (0 on straights)
# [5]  stamina_ratio           — current_stamina / max_stamina [0, 1]
# [6]  effective_cruise_speed  — post-modifier cruise speed (so agent knows current capability)
# [7]  effective_max_speed     — post-modifier max speed
# [8-9]   relative_pos_horse_1 — (tangential_offset, normal_offset) to nearest horse
# [10-11] relative_pos_horse_2
# [12-13] relative_pos_horse_3
# [14] cornering_margin        — (tolerated - required) cornering force; negative = draining stamina
```

### Multi-Agent (PettingZoo ParallelEnv)

```python
from pettingzoo import ParallelEnv

class HorseRacingEnv(ParallelEnv):
    metadata = {"name": "horse_racing_v0", "render_modes": ["human"]}

    def __init__(self, track_path="tracks/exp_track_8.json", config=None):
        self.possible_agents = [f"horse_{i}" for i in range(HORSE_COUNT)]
        self.engine = HorseRacingEngine(track_path, config)
        # Define per-agent observation and action spaces
        ...

    def reset(self, seed=None, options=None):
        self.agents = self.possible_agents[:]
        self.engine.reset()
        observations = self._get_observations()
        return observations, {agent: {} for agent in self.agents}

    def step(self, actions):
        # actions: dict[str, np.ndarray] where key is agent name
        action_list = [
            HorseAction(actions[f"horse_{i}"][0], actions[f"horse_{i}"][1])
            for i in range(len(self.agents))
        ]
        self.engine.step(action_list)
        observations = self._get_observations()
        rewards = self._compute_rewards()
        terminated = self._check_terminated()  # e.g., horse crossed finish
        truncated = self._check_truncated()    # e.g., max steps reached
        infos = {agent: {} for agent in self.agents}
        return observations, rewards, terminated, truncated, infos
```

### Reward Function

Start simple in `reward.py`, make it modular for experimentation:

```python
def compute_reward(obs_prev, obs_curr, collision_occurred):
    reward = 0.0
    # Forward progress (primary signal)
    reward += 1.0 * (obs_curr.track_progress - obs_prev.track_progress)
    # Speed bonus
    reward += 0.1 * (obs_curr.tangential_vel / obs_curr.effective_max_speed)
    # Lane-holding penalty
    reward -= 0.05 * abs(obs_curr.displacement)
    # Collision penalty
    if collision_occurred:
        reward -= 1.0
    # Stamina management — small penalty for running on empty
    if obs_curr.stamina_ratio < 0.15:
        reward -= 0.1
    # Finish bonus
    if obs_curr.track_progress >= 1.0:
        reward += 100.0
    return reward
```

## Validation Against JS Server

The JS repo will have a validation server at `http://localhost:3456/simulate` that accepts:

```json
POST /simulate
{
    "track": "exp_track_8",
    "actions": [
        [{"extraTangential": 0, "extraNormal": 0}, ...],  // step 0, per horse
        [{"extraTangential": 5, "extraNormal": -2}, ...],  // step 1, per horse
        ...
    ],
    "steps": 1000
}
```

And returns trajectories:
```json
{
    "trajectories": [
        [{"x": ..., "y": ..., "vx": ..., "vy": ...}, ...],  // step 0, per horse
        ...
    ]
}
```

Create `validation.py` that:
1. Runs the same action sequence through both the Python engine and the JS server
2. Compares position trajectories with tolerance ~0.01 units
3. Reports max divergence and step where it occurs
4. Start validation with zero-action trajectories (pure auto-cruise) before testing with actions

```python
def validate_trajectory(track_path, actions, js_server_url="http://localhost:3456"):
    # Run Python engine
    py_trajectories = run_python_engine(track_path, actions)
    # Query JS server
    js_trajectories = query_js_server(js_server_url, track_path, actions)
    # Compare
    max_divergence = 0
    for step in range(len(actions)):
        for horse in range(HORSE_COUNT):
            dx = py_trajectories[step][horse].x - js_trajectories[step][horse].x
            dy = py_trajectories[step][horse].y - js_trajectories[step][horse].y
            dist = (dx**2 + dy**2) ** 0.5
            max_divergence = max(max_divergence, dist)
    return max_divergence
```

## Training Scripts

### Basic PPO training with SB3 + PettingZoo:

```python
# scripts/train.py
from stable_baselines3 import PPO
from supersuit import pettingzoo_env_to_vec_env_v1, concat_vec_envs_v1

env = HorseRacingEnv(track_path="tracks/exp_track_8.json")
vec_env = pettingzoo_env_to_vec_env_v1(env)
vec_env = concat_vec_envs_v1(vec_env, num_vec_envs=8, base_class="stable_baselines3")

model = PPO("MlpPolicy", vec_env, verbose=1, n_steps=2048, batch_size=256)
model.learn(total_timesteps=10_000_000)
model.save("horse_racing_ppo")
```

### Curriculum ideas (for later):
1. Start on a simple oval track, then increase track complexity
2. Start single-agent (1 horse), then add opponents
3. Start with sparse reward (finish bonus only), then add shaping

## Track JSON Files

Copy the track JSON files from the JS repo at `apps/horse-racing/public/tracks/`. These are the authoritative track definitions shared between both implementations.

## Key Risks and Mitigations

1. **Physics divergence**: The main risk. Mitigate by validating early and often against the JS server, starting with the simplest scenarios (zero actions, straight track only).
2. **Collision resolution ordering**: If horses collide simultaneously, the resolution order matters. The JS engine uses a specific broad-phase (DynamicTree). For validation, start with scenarios that avoid horse-horse collisions.
3. **Floating-point accumulation**: Small differences compound over many steps. Accept ~0.01 unit tolerance per step, but flag if divergence grows over time.
