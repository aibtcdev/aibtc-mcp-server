/**
 * AIBTC News tools — deprecated.
 *
 * aibtc.news migrated from an off-chain newsroom API to on-chain governance, and
 * every endpoint these tools called now answers 410 Gone. The tool names stay
 * registered so an agent that still calls one is told where the workflow moved
 * (the legion_* tools) instead of getting "unknown tool".
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createJsonResponse } from "../utils/index.js";

const MIGRATION_NOTE =
  "aibtc.news no longer runs an off-chain newsroom API — every endpoint returns 410 Gone. " +
  "Pieces are now inscribed to Bitcoin and published through the News Legion governance " +
  "contract (SP5Y3W3F78NKFH4HYFNDQMJC484VZWKDH35ZR2M9.aibtc-news-gov) on Stacks mainnet. " +
  "Nothing is filed, edited, reviewed or paid out through this API anymore.";

/** Each retired tool and the legion workflow that replaces it. */
const RETIRED_NEWS_TOOLS: Record<string, { was: string; useInstead: string[] }> = {
  news_list_signals: {
    was: "browse the signal feed",
    useInstead: ["legion_list_stories"],
  },
  news_front_page: {
    was: "read the compiled daily brief",
    useInstead: ["legion_list_stories", "legion_get_story"],
  },
  news_leaderboard: {
    was: "rank correspondents",
    useInstead: ["legion_status", "legion_list_stories"],
  },
  news_check_status: {
    was: "check a correspondent's signals and earnings",
    useInstead: ["legion_my_position"],
  },
  news_list_beats: {
    was: "list beats",
    useInstead: ["legion_status"],
  },
  news_claim_beat: {
    was: "claim or join a beat",
    useInstead: ["legion_contribute"],
  },
  news_file_signal: {
    was: "file a signal",
    useInstead: ["legion_inscribe_story", "legion_inscribe_reveal", "legion_propose_story"],
  },
  news_file_correction: {
    was: "file a correction",
    useInstead: ["legion_vote"],
  },
  news_editor_review_signal: {
    was: "review a signal as an editor",
    useInstead: ["legion_get_story", "legion_vote"],
  },
  news_editor_file_review: {
    was: "file an editor review",
    useInstead: ["legion_get_story", "legion_vote"],
  },
  news_editor_check_earnings: {
    was: "check editor earnings",
    useInstead: ["legion_my_position"],
  },
  news_register_editor: {
    was: "register an editor",
    useInstead: ["legion_contribute"],
  },
  news_deactivate_editor: {
    was: "deactivate an editor",
    useInstead: ["legion_status"],
  },
  news_list_editors: {
    was: "list editors",
    useInstead: ["legion_status"],
  },
  news_publisher_compile_brief: {
    was: "compile the daily brief",
    useInstead: ["legion_conclude"],
  },
  news_publisher_set_beat_config: {
    was: "configure a beat",
    useInstead: ["legion_status"],
  },
  news_record_editor_payout: {
    was: "record an editor payout",
    useInstead: ["legion_conclude"],
  },
};

export function registerNewsTools(server: McpServer): void {
  for (const [name, { was, useInstead }] of Object.entries(RETIRED_NEWS_TOOLS)) {
    server.registerTool(
      name,
      {
        description:
          `⛔ DEPRECATED — do not use. This tool used to ${was} via the aibtc.news API, which ` +
          `has been shut down (410 Gone). aibtc.news now runs on on-chain governance: use ` +
          `${useInstead.join(", ")} instead (start with legion_status).`,
        inputSchema: {},
      },
      async () =>
        createJsonResponse({
          success: false,
          deprecated: true,
          error: `${name} has been removed. ${MIGRATION_NOTE}`,
          useInstead,
          note:
            "Start with legion_status. To publish: legion_inscribe_story → legion_inscribe_reveal → " +
            "legion_propose_story. To judge: legion_get_story → legion_vote → legion_conclude.",
        })
    );
  }
}
