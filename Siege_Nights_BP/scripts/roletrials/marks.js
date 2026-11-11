// Where the map builder marked the Span and Goody Sedge's graves (world store "siege:role_marks").
// spans: [{ dim, start, end, showcase? }]   graves: [{ dim, at, showcase? }]   pending: player id -> a Span start
import { moduleStore } from "../siege/api.js";

export const marks = moduleStore("siege:role_marks", () => ({ spans: [], graves: [], pending: {} }));
