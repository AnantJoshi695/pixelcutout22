/**
 * Test-only module for the browser harness in `../_e2e`.
 *
 * Lives at the project root, outside `src`, and nothing in the app imports it,
 * so it is never part of the production bundle. It exists because a bare
 * specifier (`@imgly/background-removal`) cannot be resolved from code passed to
 * `page.evaluate`; going through a module Vite serves makes the import work.
 */
export { removeBackground as runModel } from '@imgly/background-removal';
export { profileFor } from './src/services/backgroundRemovalService';
export { refineAlphaMask, blurWidthFor, resolveRadii } from './src/services/alphaRefinement';
