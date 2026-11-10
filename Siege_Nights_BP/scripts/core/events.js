// Events and hooks: how features talk to each other without editing each other's files.
//
//   on("siegeEnd", (data) => ...)        listen for something that happened (see MODULES.md for the list)
//   emit("myFeatureThing", { ... })      announce something yourself
//   addFilter("guardLimit", (value, context) => newValue)
//                                        change a value Siege Nights is about to use. Return undefined to
//                                        leave it alone. With no filters, every value passes through as is.

const listeners = new Map(); // event name -> [fn]
const filters = new Map(); // filter name -> [fn]

export function on(name, fn) {
  if (!listeners.has(name)) listeners.set(name, []);
  listeners.get(name).push(fn);
}

export function emit(name, data = {}) {
  for (const fn of listeners.get(name) ?? []) {
    try {
      fn(data);
    } catch (e) {
      console.warn(`[Hollow Crown] "${name}" listener failed: ${e}`);
    }
  }
}

export function addFilter(name, fn) {
  if (!filters.has(name)) filters.set(name, []);
  filters.get(name).push(fn);
}

export function applyFilter(name, value, context = {}) {
  for (const fn of filters.get(name) ?? []) {
    try {
      const result = fn(value, context);
      if (result !== undefined) value = result;
    } catch (e) {
      console.warn(`[Hollow Crown] "${name}" hook failed: ${e}`);
    }
  }
  return value;
}

export const hasFilters = (name) => (filters.get(name)?.length ?? 0) > 0;
