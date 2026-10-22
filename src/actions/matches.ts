"use server";

import { db } from "@/db";
import { match, player_match_score } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";

export const createNewMatch = async (
  tournamentId: number,
  team1Id: number,
  team2Id: number,
  score: string
) => {
  // single round robin: each pair of teams plays only once per tournament
  const existing = await db
    .select({ id: match.id })
    .from(match)
    .where(
      and(
        eq(match.tournament_id, tournamentId),
        or(
          and(eq(match.team1_id, team1Id), eq(match.team2_id, team2Id)),
          and(eq(match.team1_id, team2Id), eq(match.team2_id, team1Id))
        )
      )
    );
  if (existing.length !== 0) {
    return { error: "These teams have already played each other" };
  }

  await db.insert(match).values({
    tournament_id: tournamentId,
    team1_id: team1Id,
    team2_id: team2Id,
    score,
  });
  return { success: true };
};

export const getMatchesForTournament = async (tournamentId: number) => {
  const matches = await db
    .select()
    .from(match)
    .where(eq(match.tournament_id, tournamentId));
  return matches;
};

// export const createPlayerMatchEntry = async (
//   playerId: number,
//   matchId: number,
//   score: number,
//   blowjobs: number
// ) => {
//   await db.insert(player_match_score).values({
//     player_id: playerId,
//     match_id: matchId,
//     score,
//     blowjobs,
//   });
// };

export const deleteMatch = async (id: number) => {
  const tournament_id = await db
    .delete(match)
    .where(eq(match.id, id))
    .returning({ deletedId: match.tournament_id });
  redirect("/" + tournament_id[0].deletedId);
};
