# Examples

| Spec | Shows | Preview |
|---|---|---|
| `egg.json` | the egg formula, a 3-stop colour gradient, an arched door cut out | `egg-preview.png` |
| `vale-house.json` | a whole Vale timber house from one `house` part: jettied upper storey, leaf boxes, shutters, canopy, gable roof, Mateo's chimney | `vale-house-preview.png`, `vale-house-stages.png` |
| `l-plan-house.json` | an L plan: wing joined with one roof (valley), dormer, porch, planters, arched jetty supports, ridge finials, vines | `l-plan-house-preview.png` |
| `stone-hall-and-tower.json` | a stone house (grand door, hip roof, string course) beside a shape-built round tower with a waxed copper cone and arched windows | `stone-hall-and-tower-preview.png` |

    python3 ../scripts/build.py vale-house.json /tmp/house --stages
