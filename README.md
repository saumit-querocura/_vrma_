# Varma web research workspace

The separate frontend for **Varma by QueroCura**. It uses the backend's same-origin localhost API, with no paid model or CDN dependency.

From the backend checkout, run:

```powershell
& './.venv/Scripts/python.exe' -m varma_foundation.web.server --frontend '../_vrma_' --port 8765
```

Open `http://127.0.0.1:8765/`. The backend checkout may have a different relative path on your machine; pass its frontend sibling path with `--frontend`. The site does not work as a standalone `file://` page because chemistry and disease records come from the backend.

The molecule studio calculates 2D/3D structure and descriptors; the disease flow uses source-linked research outputs. HMGCR activity scoring, reaction mechanism prediction, synthesis preparation and clinical simulation are **not available** in this release. The website will show these gates rather than invent a result.

Bundled 3Dmol.js 2.5.5 is under its upstream BSD-3-Clause terms with incorporated-code notices in `THIRD-PARTY-NOTICES.txt`. The Varma frontend itself has no public reuse licence assigned yet; repository visibility alone does not grant commercial reuse of the QueroCura code or brand.

