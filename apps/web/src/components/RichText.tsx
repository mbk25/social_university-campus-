"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";

const PATTERN = /(@[a-z0-9_]{3,24})|(#[\p{L}\p{N}_]{2,30})|(https?:\/\/[^\s<]+)/giu;

/** Gönderi metnindeki @kullanıcı, #etiket ve bağlantıları tıklanabilir yapar. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  PATTERN.lastIndex = 0;
  while ((match = PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>);
    }

    const token = match[0];
    if (token.startsWith("@")) {
      nodes.push(
        <Link
          key={key++}
          href={`/u/${token.slice(1).toLowerCase()}`}
          className="font-medium brand-text hover:underline"
        >
          {token}
        </Link>,
      );
    } else if (token.startsWith("#")) {
      nodes.push(
        <Link
          key={key++}
          href={`/etiket/${encodeURIComponent(token.slice(1).toLocaleLowerCase("tr"))}`}
          className="font-medium brand-text hover:underline"
        >
          {token}
        </Link>,
      );
    } else {
      let display = token.replace(/^https?:\/\//, "");
      if (display.length > 48) display = `${display.slice(0, 45)}…`;
      nodes.push(
        <a
          key={key++}
          href={token}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="font-medium brand-text hover:underline"
        >
          {display}
        </a>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }

  return <p className={className}>{nodes}</p>;
}
