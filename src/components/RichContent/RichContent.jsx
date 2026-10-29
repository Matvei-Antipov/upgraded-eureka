import React, { useState } from 'react';
import { translations } from '../../i18n/translations';
import { PREVIEW_LENGTH } from '../../config';

/**
 * Shared renderer for post and comment bodies:
 * - fenced code blocks ```lang ... ``` with a copy button;
 * - inline code `...`;
 * - markdown images ![alt](url).
 */
const RichContent = ({ text, compact = false, language = 'uk' }) => {
  const [copiedIndex, setCopiedIndex] = useState(null);
  if (!text) return null;

  const t = translations[language] || translations.uk;

  const handleCopyCode = (e, codeStr, idx) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(codeStr);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }
    segments.push({
      type: 'code',
      lang: match[1] || 'code',
      content: match[2].replace(/\n$/, ''),
    });
    lastIndex = codeBlockRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  let shownImageInCompact = false;
  let remainingChars = PREVIEW_LENGTH;

  const renderTextWithImagesAndInlineCode = (rawStr, parentKey) => {
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const parts = [];
    let lastPos = 0;
    let imgMatch;

    while ((imgMatch = imgRegex.exec(rawStr)) !== null) {
      if (imgMatch.index > lastPos) {
        parts.push({
          kind: 'plain',
          val: rawStr.slice(lastPos, imgMatch.index),
        });
      }
      parts.push({
        kind: 'img',
        alt: imgMatch[1] || 'image',
        src: imgMatch[2],
      });
      lastPos = imgRegex.lastIndex;
    }
    if (lastPos < rawStr.length) {
      parts.push({ kind: 'plain', val: rawStr.slice(lastPos) });
    }

    return parts.map((p, idx) => {
      if (p.kind === 'img') {
        if (compact && shownImageInCompact) return null;
        shownImageInCompact = true;
        return (
          <div
            key={`${parentKey}-img-${idx}`}
            className={`rich-image-wrap ${compact ? 'compact' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <img src={p.src} alt={p.alt} className="rich-embedded-image" />
          </div>
        );
      }

      let rawVal = p.val;
      if (compact) {
        if (remainingChars <= 0) return null;
        if (rawVal.length > remainingChars) {
          rawVal = `${rawVal.slice(0, remainingChars).trimEnd()}…`;
          remainingChars = 0;
        } else {
          remainingChars -= rawVal.length;
        }
      }

      const inlineParts = rawVal.split(/(`[^`]+`)/g);
      return (
        <span key={`${parentKey}-txt-${idx}`} className="rich-text-span">
          {inlineParts.map((token, tIdx) => {
            if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
              return (
                <code key={tIdx} className="rich-inline-code">
                  {token.slice(1, -1)}
                </code>
              );
            }
            return token;
          })}
        </span>
      );
    });
  };

  const renderedSegments = compact ? segments.slice(0, 3) : segments;

  return (
    <div className={`rich-content-body ${compact ? 'compact-preview' : ''}`}>
      {renderedSegments.map((seg, i) => {
        if (seg.type === 'code') {
          const codeLines = seg.content.split('\n');
          const previewCode =
            compact && codeLines.length > 6
              ? `${codeLines.slice(0, 6).join('\n')}\n// ...`
              : seg.content;
          return (
            <div
              key={`code-${i}`}
              className="rich-code-block"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rich-code-header">
                <span className="rich-code-lang">{seg.lang}</span>
                <button
                  type="button"
                  className="rich-copy-code-btn"
                  onClick={(e) => handleCopyCode(e, seg.content, i)}
                >
                  {copiedIndex === i ? t.copiedCodeBtn : t.copyCodeBtn}
                </button>
              </div>
              <pre className="rich-code-pre">
                <code>{previewCode}</code>
              </pre>
            </div>
          );
        }
        return (
          <div key={`txt-${i}`} className="rich-paragraph">
            {renderTextWithImagesAndInlineCode(seg.content, i)}
          </div>
        );
      })}
    </div>
  );
};

export default RichContent;
