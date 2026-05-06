---
'@ue-too/dynamics': patch
---

fix(dynamics): only apply static-friction-like velocity clamp when friction is enabled

The check `|v| < |F*dt/m|` that zeroes velocity in `BaseRigidBody.step` previously ran unconditionally. When `frictionEnabled=false` (the default) and a body has a ramping force applied (e.g. through a first-order lag on a controller input), this creates a stable fixed point at `|v| = |F*dt/m|` where the body gets pinned instead of accelerating. The clamp now lives inside the `frictionEnabled` branch alongside the other friction logic.
