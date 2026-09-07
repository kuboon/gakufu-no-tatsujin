/**
 * The deploy prefix, computed once.
 *
 * The Pages workflow passes the full public URL in `BASE_URL`; locally it is unset and the site is
 * served from the root. Everything that emits a URL — the shell, the pages, the router — reads it
 * from here.
 *
 * This is server-only now. Islands used to need it too, because a `clientEntry()` id was a URL they
 * built themselves; they name themselves logically instead, so the browser never sees this value.
 */

import { normalizeBase } from "@kuboon/remix-ssg/site";

/** Where `main` is published. What stands in when `BASE_URL` says nothing. */
const CANONICAL = "https://kuboon.github.io/gakufu-no-tatsujin";

/** URL path prefix the site is mounted under, without a trailing slash (e.g. `''` or `/repo`). */
export const base: string = normalizeBase(Deno.env.get("BASE_URL"));

/**
 * The same place, absolute — origin and all.
 *
 * Open Graph tags have to carry absolute URLs: a scraper reads the tag on its
 * own, without the page it came from, so a path is not enough. That is the one
 * thing {@link base} drops, which is why this exists beside it.
 *
 * A build with no `BASE_URL` — anyone running `deno task build` by hand — has
 * no host to name, so the canonical deploy stands in. A card shared from such
 * a build then points at the real site rather than at nothing.
 */
export const siteUrl: string = absolute(Deno.env.get("BASE_URL"));

function absolute(value: string | undefined): string {
  try {
    // A path-only value says where on a host, not which host, and `URL` throws
    // on it — which is the answer we want.
    return new URL(value ?? "").href.replace(/\/$/, "");
  } catch {
    return CANONICAL;
  }
}
