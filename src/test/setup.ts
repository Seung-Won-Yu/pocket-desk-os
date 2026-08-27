// Registers the jest-dom matchers on vitest's `expect`. Importing this does not
// require a DOM, so the node-environment suites load it harmlessly; only the
// component tests that opt into jsdom actually use the matchers.
import "@testing-library/jest-dom/vitest";
