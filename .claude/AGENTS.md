Use drizzle-kit for database management. https://orm.drizzle.team/docs/kit-overview

Use 'bd' for task tracking.

# Coding Style

* Prefer named exports over than default exports
* Prefer const style over function unless awkward
* In tests prefer `describe` with `beforeEach` to set up scenarios and use one or more `it`s to assert.
* Test files for specific files should go in `__tests__` folders next to the files they test.

# Validation

* `pnpm typecheck` and `pnpm test` from root