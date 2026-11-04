# Hooks layer — split by purpose

- `interaction/`: 2号 owns user interaction and UI-state hooks.
- `data/`: 3号 owns queries, subscriptions and domain-data hooks.
- Visual-only hooks: 1号 owns only when they do not alter business or interaction contracts.

Every hook must document inputs, outputs, side effects and consumers.
