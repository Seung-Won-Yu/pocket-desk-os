/**
 * The window title Windows puts in the title bar, the Alt+Tab list and the Task
 * View card: the open document, then the app. Every surface that names a window
 * uses this so two windows of one app can be told apart the same way in all of
 * them.
 */
export function formatWindowTitle(appTitle: string, documentLabel?: string) {
  return documentLabel ? `${documentLabel} - ${appTitle}` : appTitle;
}
