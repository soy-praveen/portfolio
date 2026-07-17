# pscope.site — Sahukari Praveen

Personal portfolio: a field notebook that simulates. Instead of describing my
work, the site executes it.

- **/** — the notebook. The hero runs the actual planning loop from my Kaggle
  Silver Orbit Wars agent (depth-2 expectimax, 18-tick intercepts) live on a
  canvas. A real pruned neural network does forward passes in the projects
  section. My Kaggle ranks are drawn as one dot per competing team.
- **/orbit-wars/** — a playable game. Duel (1v1) or Melee (1v3) against a
  faithful JavaScript port of my real competition agent `ah_mild`: safe-drain
  fleet sizing, ETA-aware reinforcement risk, competitive flow scoring, and
  depth-2 expectimax in duels.
- **/neurogolf/** — the extended record of my 400-network NeuroGolf submission.
  Every statistic is mined from the actual `.onnx` files: median 103 parameters,
  nine zero-parameter solutions, a 148-byte smallest model.
- **/atrium/**, **/sovereign/**, **/laurel/** — field sheets for the 3D
  reconstruction, smart-contract marketplace, and resume-intelligence projects.
- **/aural/** — a spatial-audio studio, running live in the browser.

## Engineering notes

Hand-set in HTML, CSS and vanilla JavaScript — no frameworks, no build step.
Typeset in Fraunces and Inter, in an ink-and-gold design system with light and
dark editions that follow the system theme (with a persistent manual override).
Reduced-motion is the default stylesheet — all animation is layered on inside
`@media (prefers-reduced-motion: no-preference)`. The print stylesheet is a
deliverable: Ctrl+P yields a clean two-page document.

Deployed on Cloudflare Pages. No build command; output directory is the
repository root.

## Contact

- phixbugs@gmail.com
- [linkedin.com/in/soy-praveen](https://www.linkedin.com/in/soy-praveen/)
- [kaggle.com/praveensahukari](https://www.kaggle.com/praveensahukari)
