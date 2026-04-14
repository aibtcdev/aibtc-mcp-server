import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import WebSocket from "ws";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getWalletManager } from "../services/wallet-manager.js";
import {
  finalizeEvent,
  getPublicKey,
  type EventTemplate,
  type VerifiedEvent,
} from "nostr-tools/pure";
import * as nip19 from "nostr-tools/nip19";
import { SimplePool } from "nostr-tools/pool";
import type { Filter } from "nostr-tools/filter";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RELAYS = ["wss://relay.damus.io", "wss://nos.lol"];
const WS_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function deriveNostrKeys(): { sk: Uint8Array; pubkey: string; npub: string } {
  const walletManager = getWalletManager();
  const account = walletManager.getActiveAccount();
  if (!account) {
    throw new Error("Wallet is not unlocked. Use wallet_unlock first.");
  }
  if (!account.nostrPrivateKey) {
    throw new Error("Nostr private key not available. Re-unlock your wallet.");
  }
  const sk = account.nostrPrivateKey;
  const pubkey = getPublicKey(sk);
  const npub = nip19.npubEncode(pubkey);
  return { sk, pubkey, npub };
}

function resolveHexPubkey(input: string): string {
  if (input.startsWith("npub")) {
    const decoded = nip19.decode(input);
    return decoded.data as string;
  }
  return input;
}

function createPool(): SimplePool {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).WebSocket = WebSocket;
  return new SimplePool();
}

async function publishToRelays(
  pool: SimplePool,
  event: VerifiedEvent,
  relays: string[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.allSettled(
    relays.map(async (relay) => {
      try {
        const pubPromises = pool.publish([relay], event);
        await Promise.race([
          ...pubPromises,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), WS_TIMEOUT_MS)
          ),
        ]);
        results[relay] = "ok";
      } catch (err: unknown) {
        results[relay] = `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    })
  );
  return results;
}

async function queryRelays(
  pool: SimplePool,
  relays: string[],
  filter: Filter
): Promise<VerifiedEvent[]> {
  return Promise.race([
    pool.querySync(relays, filter) as Promise<VerifiedEvent[]>,
    new Promise<VerifiedEvent[]>((_, reject) =>
      setTimeout(
        () => reject(new Error("query timeout")),
        WS_TIMEOUT_MS * 2
      )
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerNostrTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // nostr_get_pubkey
  // -------------------------------------------------------------------------
  server.registerTool(
    "nostr_get_pubkey",
    {
      description:
        "Derive the Nostr public key from the active wallet. " +
        "Uses the NIP-06 derivation path (m/44'/1237'/0'/0/0). " +
        "Returns both hex pubkey and npub (bech32) formats. " +
        "Requires an unlocked wallet.",
      inputSchema: {},
    },
    async () => {
      try {
        const { pubkey, npub } = deriveNostrKeys();
        return createJsonResponse({ pubkey, npub });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // -------------------------------------------------------------------------
  // nostr_post
  // -------------------------------------------------------------------------
  server.registerTool(
    "nostr_post",
    {
      description:
        "Publish a short-text note (kind:1) to Nostr relays. " +
        "Optionally include hashtag tags and specify target relays. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        content: z.string().describe("The note content to publish."),
        tags: z
          .string()
          .optional()
          .describe(
            "Comma-separated hashtags to include (e.g., 'bitcoin,nostr,aibtc'). " +
              "Do not include the '#' prefix."
          ),
        relays: z
          .array(z.string().url())
          .optional()
          .describe(
            `Relay URLs to publish to. Defaults to ${DEFAULT_RELAYS.join(", ")}.`
          ),
      },
    },
    async ({ content, tags, relays }) => {
      try {
        const { sk } = deriveNostrKeys();
        const targetRelays = relays && relays.length > 0 ? relays : DEFAULT_RELAYS;

        const hashtagTags: string[][] = tags
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .map((t) => ["t", t.toLowerCase()])
          : [];

        const template: EventTemplate = {
          kind: 1,
          created_at: Math.floor(Date.now() / 1000),
          tags: hashtagTags,
          content,
        };

        const event = finalizeEvent(template, sk);
        const pool = createPool();
        const publishResults = await publishToRelays(pool, event, targetRelays);
        pool.close(targetRelays);

        return createJsonResponse({
          eventId: event.id,
          pubkey: event.pubkey,
          createdAt: event.created_at,
          content: event.content,
          tags: event.tags,
          relays: publishResults,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // -------------------------------------------------------------------------
  // nostr_read_feed
  // -------------------------------------------------------------------------
  server.registerTool(
    "nostr_read_feed",
    {
      description:
        "Read recent kind:1 notes from Nostr relays. " +
        "Optionally filter by author pubkey. " +
        "No wallet required.",
      inputSchema: {
        pubkey: z
          .string()
          .optional()
          .describe("Author public key (hex or npub) to filter by."),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of notes to return (default: 20)."),
        relay: z
          .string()
          .url()
          .optional()
          .describe("Single relay URL to query. Defaults to all DEFAULT_RELAYS."),
      },
    },
    async ({ pubkey, limit, relay }) => {
      try {
        const pool = createPool();
        const targetRelays = relay ? [relay] : DEFAULT_RELAYS;
        const queryLimit = limit ?? 20;

        const filter: Filter = {
          kinds: [1],
          limit: queryLimit,
        };

        if (pubkey) {
          filter.authors = [resolveHexPubkey(pubkey)];
        }

        const events = await queryRelays(pool, targetRelays, filter);
        pool.close(targetRelays);

        // Sort descending by created_at
        const sorted = events
          .sort((a, b) => b.created_at - a.created_at)
          .slice(0, queryLimit)
          .map((e) => ({
            id: e.id,
            pubkey: e.pubkey,
            npub: nip19.npubEncode(e.pubkey),
            createdAt: e.created_at,
            content: e.content,
            tags: e.tags,
          }));

        return createJsonResponse({
          count: sorted.length,
          events: sorted,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // -------------------------------------------------------------------------
  // nostr_search_tags
  // -------------------------------------------------------------------------
  server.registerTool(
    "nostr_search_tags",
    {
      description:
        "Search Nostr for kind:1 notes matching hashtags using NIP-12 #t filter. " +
        "No wallet required.",
      inputSchema: {
        tags: z
          .string()
          .describe(
            "Comma-separated hashtags to search for (e.g., 'bitcoin,nostr'). " +
              "Do not include the '#' prefix."
          ),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of notes to return (default: 20)."),
        relay: z
          .string()
          .url()
          .optional()
          .describe("Single relay URL to query. Defaults to all DEFAULT_RELAYS."),
      },
    },
    async ({ tags, limit, relay }) => {
      try {
        const pool = createPool();
        const targetRelays = relay ? [relay] : DEFAULT_RELAYS;
        const queryLimit = limit ?? 20;

        const tagList = tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);

        const filter: Filter = {
          kinds: [1],
          "#t": tagList,
          limit: queryLimit,
        };

        const events = await queryRelays(pool, targetRelays, filter);
        pool.close(targetRelays);

        const sorted = events
          .sort((a, b) => b.created_at - a.created_at)
          .slice(0, queryLimit)
          .map((e) => ({
            id: e.id,
            pubkey: e.pubkey,
            npub: nip19.npubEncode(e.pubkey),
            createdAt: e.created_at,
            content: e.content,
            tags: e.tags,
          }));

        return createJsonResponse({
          searchTags: tagList,
          count: sorted.length,
          events: sorted,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // -------------------------------------------------------------------------
  // nostr_get_profile
  // -------------------------------------------------------------------------
  server.registerTool(
    "nostr_get_profile",
    {
      description:
        "Get a Nostr profile (kind:0 metadata) for any public key. " +
        "No wallet required.",
      inputSchema: {
        pubkey: z
          .string()
          .describe("Public key to look up (hex or npub bech32 format)."),
        relay: z
          .string()
          .url()
          .optional()
          .describe("Single relay URL to query. Defaults to all DEFAULT_RELAYS."),
      },
    },
    async ({ pubkey, relay }) => {
      try {
        const pool = createPool();
        const targetRelays = relay ? [relay] : DEFAULT_RELAYS;
        const hexPubkey = resolveHexPubkey(pubkey);

        const filter: Filter = {
          kinds: [0],
          authors: [hexPubkey],
          limit: 1,
        };

        const events = await queryRelays(pool, targetRelays, filter);
        pool.close(targetRelays);

        if (events.length === 0) {
          return createJsonResponse({
            pubkey: hexPubkey,
            npub: nip19.npubEncode(hexPubkey),
            found: false,
            profile: null,
          });
        }

        // Use most recent kind:0 event
        const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
        let profile: Record<string, unknown> = {};
        try {
          profile = JSON.parse(latest.content) as Record<string, unknown>;
        } catch {
          // content was not valid JSON — return as-is
          profile = { raw: latest.content };
        }

        return createJsonResponse({
          pubkey: hexPubkey,
          npub: nip19.npubEncode(hexPubkey),
          found: true,
          updatedAt: latest.created_at,
          profile,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // -------------------------------------------------------------------------
  // nostr_set_profile
  // -------------------------------------------------------------------------
  server.registerTool(
    "nostr_set_profile",
    {
      description:
        "Update the agent's Nostr profile (kind:0 metadata event). " +
        "Only provided fields are updated; existing fields are preserved by fetching " +
        "the current profile first. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        name: z.string().optional().describe("Display name."),
        about: z.string().optional().describe("Bio / about text."),
        picture: z.string().url().optional().describe("Profile picture URL."),
        banner: z
          .string()
          .url()
          .optional()
          .describe(
            "Header/cover image URL. Displayed above the profile picture in most Nostr clients (Primal, Snort, Damus)."
          ),
        website: z.string().url().optional().describe("Website URL."),
        nip05: z
          .string()
          .optional()
          .describe("NIP-05 identifier (e.g., user@example.com)."),
        relays: z
          .array(z.string().url())
          .optional()
          .describe(
            `Relay URLs to publish to. Defaults to ${DEFAULT_RELAYS.join(", ")}.`
          ),
      },
    },
    async ({ name, about, picture, banner, website, nip05, relays }) => {
      try {
        const { sk, pubkey } = deriveNostrKeys();
        const targetRelays = relays && relays.length > 0 ? relays : DEFAULT_RELAYS;
        const pool = createPool();

        // Fetch existing profile to preserve fields
        let existingProfile: Record<string, unknown> = {};
        try {
          const existing = await queryRelays(pool, targetRelays, {
            kinds: [0],
            authors: [pubkey],
            limit: 1,
          });
          if (existing.length > 0) {
            const latest = existing.sort((a, b) => b.created_at - a.created_at)[0];
            existingProfile = JSON.parse(latest.content) as Record<string, unknown>;
          }
        } catch {
          // Ignore fetch errors — publish with just the new fields
        }

        // Merge: only override fields that were explicitly provided
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (about !== undefined) updates.about = about;
        if (picture !== undefined) updates.picture = picture;
        if (banner !== undefined) updates.banner = banner;
        if (website !== undefined) updates.website = website;
        if (nip05 !== undefined) updates.nip05 = nip05;

        const mergedProfile = { ...existingProfile, ...updates };

        const template: EventTemplate = {
          kind: 0,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify(mergedProfile),
        };

        const event = finalizeEvent(template, sk);
        const publishResults = await publishToRelays(pool, event, targetRelays);
        pool.close(targetRelays);

        return createJsonResponse({
          eventId: event.id,
          pubkey: event.pubkey,
          createdAt: event.created_at,
          profile: mergedProfile,
          relays: publishResults,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // -------------------------------------------------------------------------
  // nostr_relay_list
  // -------------------------------------------------------------------------
  server.registerTool(
    "nostr_relay_list",
    {
      description:
        "List the configured default Nostr relay URLs. No wallet required.",
      inputSchema: {},
    },
    async () => {
      try {
        return createJsonResponse({ relays: DEFAULT_RELAYS });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
