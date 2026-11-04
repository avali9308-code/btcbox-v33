# Utilities layer — split by purpose

- `visual/`: 1号 owns display-only helpers; must not alter underlying financial values.
- `interaction/`: 2号 owns interaction helpers.
- `data/` and `business/`: 3号 owns data/domain helpers.

No duplicated helpers or hidden business transformations. Every shared utility must have tests and a documented owner.
