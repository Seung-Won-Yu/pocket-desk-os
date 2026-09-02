import ReactMarkdown, { type Components } from "react-markdown";

/**
 * The reader view's Markdown renderer, in its own module on purpose: it is the
 * only consumer of react-markdown, whose dependency tree (micromark, mdast,
 * unified, hast) was the single largest cluster in the initial bundle at
 * roughly a quarter of the shipped source — for a view most sessions never
 * open. BrowserApp loads this lazily; the service worker precaches the chunk
 * from the build's own asset list, so it is still there offline.
 */
export default function BrowserReaderMarkdown({
  components,
  markdown,
}: {
  components: Components;
  markdown: string;
}) {
  return <ReactMarkdown components={components}>{markdown}</ReactMarkdown>;
}
