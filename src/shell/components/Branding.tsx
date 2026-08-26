import { getAssetUrl } from "../../wallpapers";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={`brand-mark ${className}`.trim()}
      src={getAssetUrl("brand/pocketdesk-mark.svg")}
    />
  );
}

export function StartGlyph() {
  return (
    <span aria-hidden="true" className="start-glyph">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
