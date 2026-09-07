/**
 * The document shell — this site's, not the framework's.
 *
 * It also carries the one thing the browser cannot work out for itself: the map from an island's
 * name to the chunk the bundler emitted, plus the scripts that load them. A page that places no
 * island gets neither, and so ships no JavaScript at all.
 */

import { renderToString } from "@remix-run/ui/server";
import type { RemixNode } from "@remix-run/ui";
import { ISLAND_MAP_ELEMENT_ID } from "@kuboon/remix-ssg/client";

import { Link } from "./lib/link.tsx";

/** What every page hands the shell. */
export interface LayoutProps {
  title: string;
  description?: string;
  /** Document language. English unless a page says otherwise. */
  lang?: string;
  /** Anything the page adds to the document head. */
  head?: RemixNode;
  /** A bare page fills the viewport itself: no header, no footer, no zooming. */
  bare?: boolean;
  /** Deploy path prefix, so every URL in the shell carries it. */
  base: string;
  /** The same deploy, absolute. What the sharing tags need. */
  siteUrl: string;
  /** This page's URL path under the mount point, for the canonical link. */
  path: string;
  /** Name -> chunk URL for the islands this page places. Empty on a page with none. */
  islandUrls: Record<string, string>;
  children: RemixNode;
}

/**
 * Renders a page inside the document shell.
 *
 * @param props The page's title, prefix, islands and body
 * @returns The complete HTML document
 */
export async function renderPage(props: LayoutProps): Promise<string> {
  const { base, siteUrl, islandUrls, bare = false } = props;
  const chunks = [...new Set(Object.values(islandUrls))];
  const home = base === "" ? "/" : base;
  // `path` is "/" for the home page, and `siteUrl` already ends without one.
  const url = `${siteUrl}${props.path === "/" ? "/" : props.path}`;
  const image = `${siteUrl}/static/og.png`;

  const html = await renderToString(
    <html lang={props.lang ?? "en"}>
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content={bare
            ? "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
            : "width=device-width, initial-scale=1"}
        />
        {bare ? <meta name="theme-color" content="#1a120d" /> : null}
        <title>{props.title}</title>
        {props.description
          ? <meta name="description" content={props.description} />
          : null}
        <link rel="canonical" href={url} />

        {
          /* What a link to this page looks like when someone shares it. The
            image is the game's own palette, staff and keyboard, so the card
            says what the game is before anyone opens it. */
        }
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="楽譜の達人" />
        <meta property="og:title" content={props.title} />
        {props.description
          ? <meta property="og:description" content={props.description} />
          : null}
        <meta property="og:url" content={url} />
        <meta property="og:image" content={image} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content="五線譜を流れる色つきの音符と、同じ色にぬり分けられた鍵盤"
        />
        <meta
          property="og:locale"
          content={props.lang === "ja" ? "ja_JP" : "en_US"}
        />
        {/* Large enough to show the staff and the keyboard at once. */}
        <meta name="twitter:card" content="summary_large_image" />

        <link rel="icon" href={`${base}/static/favicon.svg`} />
        <link rel="stylesheet" href={`${base}/static/styles.css`} />
        {props.head}
      </head>
      <body class={bare ? "bare" : undefined}>
        {bare ? null : (
          <header class="site-header">
            <Link class="brand" href={home}>楽譜の達人</Link>
            <nav class="site-nav">
              <Link href={home}>ゲーム</Link>
              <Link href={`${base}/about`}>About</Link>
              <Link href={`${base}/blog`}>Blog</Link>
            </nav>
          </header>
        )}
        {bare
          ? props.children
          : <main class="site-main">{props.children}</main>}
        {bare ? null : (
          <footer class="site-footer">
            <p>
              Built with{" "}
              <a href="https://jsr.io/@kuboon/remix-ssg">@kuboon/remix-ssg</a>
              {" "}
              and <a href="https://remix.run">Remix v3</a>.
            </p>
          </footer>
        )}
        {chunks.length > 0
          ? (
            <>
              <script type="application/json" id={ISLAND_MAP_ELEMENT_ID}>
                {JSON.stringify(islandUrls)}
              </script>
              {chunks.map((src) => (
                <script key={src} type="module" src={src}></script>
              ))}
            </>
          )
          : null}
      </body>
    </html>,
  );

  return `<!DOCTYPE html>${html}`;
}
