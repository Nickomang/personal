import React from "react";
import { parsePoe2ItemText } from "./parse";
import "./poe2-tooltip.css";

type Props = {
  text?: string;
  children?: React.ReactNode;
  className?: string;
  debug?: boolean;
};

export default function PoE2ItemTooltip({
  text,
  children,
  className,
  debug = false,
}: Props) {
  const safeText = ((text ?? "") || extractText(children)).trim();

  const parsed = parsePoe2ItemText(safeText);
  const rarityClass = `poe2-rarity-${parsed.rarity.toLowerCase()}`;

  const hasMetaLine = Boolean(parsed.itemClass) || parsed.itemLevel != null;

  return (
    <div className={`poe2-tooltip ${rarityClass} ${className ?? ""}`.trim()}>
      {debug && (
        <pre className="poe2-debug">
          {"len=" + safeText.length + " rarity=" + parsed.rarity + "\n\n"}
          {"limits=" + JSON.stringify(parsed.limits) + "\n"}
          {"\n"}
          {safeText || "(safeText is empty)"}
        </pre>
      )}

      {/* Header: name + base type only */}
      <div className="poe2-header">
        {parsed.name && <div className="poe2-name">{parsed.name}</div>}
        {parsed.baseType && parsed.baseType !== parsed.name && (
          <div className="poe2-base">{parsed.baseType}</div>
        )}
      </div>

      <Divider />

      {/* Meta line: Item Class • Item Level */}
      {hasMetaLine && (
        <>
          <div className="poe2-meta-line">
            {parsed.itemClass && <span>{parsed.itemClass}</span>}
            {parsed.itemClass && parsed.itemLevel != null && (
              <span className="poe2-dot">•</span>
            )}
            {parsed.itemLevel != null && <span>Item Level {parsed.itemLevel}</span>}
          </div>
          <Divider />
        </>
      )}

      {/* Properties */}
      {parsed.properties.length > 0 && (
        <>
          <div className="poe2-properties">
            {parsed.properties.map((line, i) => (
              <div key={i} className="poe2-line">
                {renderLine(line)}
              </div>
            ))}
          </div>
          <Divider />
        </>
      )}

      {/* Limits (e.g., Limited to: 1) */}
      {parsed.limits.length > 0 && (
        <>
          <div className="poe2-section poe2-limits">
            {parsed.limits.map((line, i) => (
              <div key={i} className="poe2-line poe2-limit-line">
                {renderLine(line)}
              </div>
            ))}
          </div>
          <Divider />
        </>
      )}

      {/* Requirements */}
      {parsed.requirements && (
        <>
          <div className="poe2-section poe2-requirements">
            <div className="poe2-line">{renderLine(parsed.requirements)}</div>
          </div>
          <Divider />
        </>
      )}

      {/* Sockets */}
      {parsed.sockets && (
        <>
          <div className="poe2-section poe2-sockets">
            <div className="poe2-section-title">Sockets</div>
            <div className="poe2-line">{renderLine(parsed.sockets)}</div>
          </div>
          <Divider />
        </>
      )}

      {/* Implicits */}
      {parsed.implicits.length > 0 && (
        <>
          <div className="poe2-mods poe2-implicits">
            {parsed.implicits.map((line, i) => (
              <div key={i} className="poe2-mod poe2-mod-implicit">
                {renderLine(line)}
              </div>
            ))}
          </div>
          <Divider />
        </>
      )}

      {/* Enchants */}
      {parsed.enchants.length > 0 && (
        <>
          <div className="poe2-mods poe2-enchants">
            {parsed.enchants.map((line, i) => (
              <div key={i} className="poe2-mod poe2-mod-special">
                {renderLine(line)}
              </div>
            ))}
          </div>
          <Divider />
        </>
      )}

      {/* Runes */}
      {parsed.runes.length > 0 && (
        <>
          <div className="poe2-mods poe2-runes">
            {parsed.runes.map((line, i) => (
              <div key={i} className="poe2-mod poe2-mod-special">
                {renderLine(line)}
              </div>
            ))}
          </div>
          <Divider />
        </>
      )}

      {/* Granted Skills */}
      {parsed.grantedSkills?.length > 0 && (
        <>
          <div className="poe2-section poe2-granted-skills">
            {parsed.grantedSkills.map((line, i) => (
              <div key={i} className="poe2-line poe2-granted-skill-line">
                {renderLine(line)}
              </div>
            ))}
          </div>
          <Divider />
        </>
      )}

      {/* Explicit mods (normal + desecrated + mutated) */}
      {(parsed.mods.length > 0 ||
        parsed.desecrated.length > 0 ||
        parsed.mutated.length > 0) && (
        <>
          <div className="poe2-mods">
            {parsed.mods.map((line, i) => (
              <div key={`m-${i}`} className="poe2-mod">
                {renderLine(line)}
              </div>
            ))}

            {parsed.desecrated.map((line, i) => (
              <div key={`d-${i}`} className="poe2-mod poe2-mod-desecrated">
                {renderLine(line)}
              </div>
            ))}

            {parsed.mutated.map((line, i) => (
              <div key={`mu-${i}`} className="poe2-mod poe2-mod-mutated">
                {renderLine(line)}
              </div>
            ))}
          </div>
          <Divider />
        </>
      )}

      {/* Corrupted */}
      {parsed.footerFlags.includes("Corrupted") && (
        <>
          <div className="poe2-footer">
            <div className="poe2-footer-flag">Corrupted</div>
          </div>
          <Divider />
        </>
      )}

      {/* Flavour text goes at the very bottom, below corruption */}
      {parsed.flavourText.length > 0 && (
        <div className="poe2-flavour">
          {parsed.flavourText.map((line, i) => (
            <div key={i} className="poe2-flavour-line">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="poe2-divider" role="separator" aria-hidden="true" />;
}

/**
 * Highlight numeric tokens.
 */
function renderLine(line: string) {
  const parts = line.split(/([+-]?\d+(?:-\d+)?%?)/g).filter(Boolean);

  return parts.map((p, i) =>
    /^[+-]?\d+(?:-\d+)?%?$/.test(p) ? (
      <span key={i} className="poe2-num">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) return extractText((node.props as any)?.children);
  return "";
}
