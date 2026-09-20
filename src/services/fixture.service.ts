import { env } from "../config/env.js";

type FixtureRecord = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  kickoff: string;
  date: string;
  competition: string;
  isHome: boolean;
};

type LiveScoreCandidate = {
  id?: string | number;
  homeTeam?: string;
  awayTeam?: string;
  venue?: string;
  date?: string;
  kickoff?: string;
  competition?: string;
  isHome?: boolean;
  home?: { name?: string; team?: string; shortName?: string };
  away?: { name?: string; team?: string; shortName?: string };
  home_team?: string;
  away_team?: string;
  venue_name?: string;
  stadium?: string;
  kickoff_time?: string;
  match_time?: string;
  scheduled_at?: string;
  event_date?: string;
  time?: string;
  status?: string;
  home_team_name?: string;
  away_team_name?: string;
  league?: string;
  competition_name?: string;
  league_name?: string;
  [key: string]: unknown;
};

const fallbackFixtures: FixtureRecord[] = [
  {
    id: "md-5",
    homeTeam: "Bendel Insurance",
    awayTeam: "Ikorodu City",
    venue: "Samuel Ogbemudia Stadium, Benin City",
    kickoff: "16:00 WAT",
    date: "2026-09-27T16:00:00+01:00",
    competition: "NPFL 2026/27",
    isHome: true,
  },
  {
    id: "md-7",
    homeTeam: "Bendel Insurance",
    awayTeam: "Enyimba International",
    venue: "Samuel Ogbemudia Stadium, Benin City",
    kickoff: "16:00 WAT",
    date: "2026-10-11T16:00:00+01:00",
    competition: "NPFL 2026/27",
    isHome: true,
  },
  {
    id: "md-9",
    homeTeam: "Bendel Insurance",
    awayTeam: "Kano Pillars",
    venue: "Samuel Ogbemudia Stadium, Benin City",
    kickoff: "16:00 WAT",
    date: "2026-10-25T16:00:00+01:00",
    competition: "NPFL 2026/27",
    isHome: true,
  },
  {
    id: "md-11",
    homeTeam: "Bendel Insurance",
    awayTeam: "Plateau United",
    venue: "Samuel Ogbemudia Stadium, Benin City",
    kickoff: "16:00 WAT",
    date: "2026-11-08T16:00:00+01:00",
    competition: "NPFL 2026/27",
    isHome: true,
  },
];

function sortByDate(a: FixtureRecord, b: FixtureRecord) {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

function buildLiveScoreHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (env.liveScore.apiKey) {
    headers["x-api-key"] = env.liveScore.apiKey;
    headers["api-key"] = env.liveScore.apiKey;
  }

  if (env.liveScore.apiToken) {
    headers.Authorization = `Bearer ${env.liveScore.apiToken}`;
    headers["X-API-Token"] = env.liveScore.apiToken;
  }

  return headers;
}

function normalizeFixture(candidate: LiveScoreCandidate): FixtureRecord | null {
  const homeTeam =
    candidate.homeTeam ??
    candidate.home?.name ??
    candidate.home?.team ??
    candidate.home_team ??
    candidate.home_team_name ??
    "Bendel Insurance";

  const awayTeam =
    candidate.awayTeam ??
    candidate.away?.name ??
    candidate.away?.team ??
    candidate.away_team ??
    candidate.away_team_name ??
    "Upcoming Opponent";

  const venue =
    candidate.venue ??
    candidate.venue_name ??
    candidate.stadium ??
    "Samuel Ogbemudia Stadium, Benin City";

  const dateValue =
    candidate.date ??
    candidate.scheduled_at ??
    candidate.event_date ??
    candidate.time ??
    candidate.kickoff_time ??
    candidate.match_time ??
    candidate.kickoff ??
    new Date().toISOString();

  const kickoff = candidate.kickoff ?? candidate.kickoff_time ?? candidate.match_time ?? candidate.time ?? "16:00 WAT";
  const competition =
    candidate.competition ??
    candidate.competition_name ??
    candidate.league ??
    candidate.league_name ??
    "NPFL 2026/27";

  const isHome =
    candidate.isHome ??
    (String(homeTeam).toLowerCase().includes("bendel") ||
      String(homeTeam).toLowerCase().includes("insurance"));

  if (!homeTeam || !awayTeam) {
    return null;
  }

  return {
    id: String(candidate.id ?? `${homeTeam}-${awayTeam}-${dateValue}`),
    homeTeam,
    awayTeam,
    venue: String(venue),
    kickoff: String(kickoff),
    date: String(dateValue),
    competition: String(competition),
    isHome: Boolean(isHome),
  };
}

async function fetchLiveScoreFixtures(): Promise<FixtureRecord[]> {
  if (!env.liveScore.baseUrl) {
    return [];
  }

  const base = env.liveScore.baseUrl.replace(/\/$/, "");
  const urls = [
    `${base}/fixtures`,
    `${base}/matches`,
    `${base}/v1/fixtures`,
    `${base}/v1/matches`,
  ];

  const headers = buildLiveScoreHeaders();

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const candidates =
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.results)
              ? payload.results
              : Array.isArray(payload?.fixtures)
                ? payload.fixtures
                : Array.isArray(payload?.matches)
                  ? payload.matches
                  : Array.isArray(payload?.items)
                    ? payload.items
                    : [];

      const normalized = (candidates as LiveScoreCandidate[])
        .map((candidate: LiveScoreCandidate) => normalizeFixture(candidate))
        .filter((fixture): fixture is FixtureRecord => Boolean(fixture));

      if (normalized.length > 0) {
        return normalized;
      }
    } catch {
      // try next candidate URL
    }
  }

  return [];
}

export async function getNextHomeFixture(): Promise<FixtureRecord | null> {
  const liveFixtures = await fetchLiveScoreFixtures();
  const now = Date.now();

  const upcomingLive = liveFixtures
    .filter((fixture) => fixture.isHome && new Date(fixture.date).getTime() >= now)
    .sort(sortByDate);

  if (upcomingLive.length > 0) {
    return upcomingLive[0];
  }

  const upcomingFallback = fallbackFixtures
    .filter((fixture) => fixture.isHome && new Date(fixture.date).getTime() >= now)
    .sort(sortByDate);

  if (upcomingFallback.length > 0) {
    return upcomingFallback[0];
  }

  const fallback = [...fallbackFixtures].sort(sortByDate);
  return fallback[0] ?? null;
}

export function getFixtureDisplayName(fixture: FixtureRecord | null) {
  if (!fixture) return "Matchday - Check Fixture Guide";

  return `${fixture.homeTeam} vs ${fixture.awayTeam}`;
}
