import { inArray } from "drizzle-orm";

import { isMissingCreatorSchemaError } from "@/lib/creators/area-errors.server";
import { DEFAULT_CREATOR_BRANDING, DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { listDemoCreatorTenants } from "@/lib/creators/demo-store";
import { normalizeCreatorSlug } from "@/lib/creators/identity";
import { listCreatorAreasForOwner } from "@/lib/creators/service";
import { getOwnedCreatorSetup } from "@/lib/creators/setup.server";
import { getDb } from "@/lib/db/client";
import { creatorBranding } from "@/lib/db/schema";

import {
  sortOwnedCommunities,
  summarizeSetup,
  type OwnedCommunity,
  type OwnedCommunityCard,
} from "./owner-dashboard";

type BrandingColors = { primaryColor: string; accentColor: string };

async function loadBrandingColors(creatorIds: string[]): Promise<Map<string, BrandingColors>> {
  const colors = new Map<string, BrandingColors>();
  if (creatorIds.length === 0) {
    return colors;
  }

  const db = getDb();
  if (!db) {
    for (const tenant of listDemoCreatorTenants()) {
      if (creatorIds.includes(tenant.creator.id)) {
        colors.set(tenant.creator.id, {
          primaryColor: tenant.branding.primaryColor,
          accentColor: tenant.branding.accentColor,
        });
      }
    }
    return colors;
  }

  try {
    const rows = await db
      .select({
        creatorId: creatorBranding.creatorId,
        primaryColor: creatorBranding.primaryColor,
        accentColor: creatorBranding.accentColor,
      })
      .from(creatorBranding)
      .where(inArray(creatorBranding.creatorId, creatorIds));
    for (const row of rows) {
      colors.set(row.creatorId, { primaryColor: row.primaryColor, accentColor: row.accentColor });
    }
  } catch (error) {
    if (!isMissingCreatorSchemaError(error)) {
      throw error;
    }
  }

  return colors;
}

/**
 * Every community owned by the signed-in viewer, including disabled and archived ones.
 * `viewerId` must come from the session, never from the request.
 */
export async function listOwnedCommunities(viewerId: string | null | undefined): Promise<OwnedCommunity[]> {
  const areas = await listCreatorAreasForOwner(viewerId, { includeArchived: true });
  const colors = await loadBrandingColors(areas.map((area) => area.id));

  return sortOwnedCommunities(
    areas.map((area) => ({
      id: area.id,
      slug: area.slug,
      displayName: area.displayName,
      status: area.status,
      publicUrl: area.publicUrl,
      isLegacy: area.id === DEFAULT_CREATOR_ID,
      primaryColor: colors.get(area.id)?.primaryColor ?? DEFAULT_CREATOR_BRANDING.primaryColor,
      accentColor: colors.get(area.id)?.accentColor ?? DEFAULT_CREATOR_BRANDING.accentColor,
    })),
  );
}

/**
 * Resolves a community by slug only among the viewer's own communities, so another
 * owner's slug is indistinguishable from a missing one. Unlike the public resolver,
 * disabled and archived communities are returned for their owner.
 */
export async function getOwnedCommunityBySlug(
  viewerId: string | null | undefined,
  slugInput: string | null | undefined,
): Promise<OwnedCommunity | null> {
  const slug = normalizeCreatorSlug(slugInput);
  if (!viewerId || !slug) {
    return null;
  }

  const communities = await listOwnedCommunities(viewerId);
  return communities.find((community) => community.slug === slug) ?? null;
}

export async function listOwnedCommunityCards(viewerId: string | null | undefined): Promise<OwnedCommunityCard[]> {
  if (!viewerId) {
    return [];
  }

  const communities = await listOwnedCommunities(viewerId);
  return Promise.all(
    communities.map(async (community): Promise<OwnedCommunityCard> => {
      if (community.isLegacy) {
        return { ...community, currencyLabel: null, setup: null };
      }

      try {
        const setup = await getOwnedCreatorSetup(viewerId, community.id);
        return { ...community, currencyLabel: setup.currencyLabel, setup: summarizeSetup(setup) };
      } catch {
        // One unavailable summary must not hide the rest of the list.
        return { ...community, currencyLabel: null, setup: null };
      }
    }),
  );
}
