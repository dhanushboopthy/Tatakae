import {
  applicationInput,
  applicationPatch,
  dateRangeQuery,
  interviewStoryInput,
  interviewStoryPatch,
  japaneseLogInput,
  japaneseLogPatch,
  normalizeTags,
  type Application,
  type ApplicationStatus,
  type InterviewStory,
  type JapaneseKind,
  type JapaneseLogEntry,
} from "@tatakae/core";
import { localCrudRoutes } from "../lib/crud";
import { stringArray } from "../lib/local.service";

// Phase v3 trackers (REST only, not synced), over lib/crud.ts localCrudRoutes:
//   /applications   job applications; open ones first, then by next step date
//   /stories        interview stories in STAR form (table `stories`)
//   /japanese       Japanese practice log; GET ?from=&to= (IST dates), newest first

const STATUS_ORDER: Record<ApplicationStatus, number> = { offer: 0, interview: 1, applied: 2, wishlist: 3, rejected: 4, withdrawn: 5 };

export const applications = localCrudRoutes({
  table: "applications",
  input: applicationInput,
  patch: applicationPatch,
  label: "application",
  decode: (r): Application => ({ ...r, status: r.status as ApplicationStatus }),
  encode: (a) => a,
  sort: (a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    (a.nextStepOn ?? "9999").localeCompare(b.nextStepOn ?? "9999") ||
    b.updatedAt.localeCompare(a.updatedAt),
});

export const interviewStories = localCrudRoutes({
  table: "stories",
  input: interviewStoryInput,
  patch: interviewStoryPatch,
  label: "story",
  decode: (r): InterviewStory => ({ ...r, tags: stringArray(r.tags) }),
  encode: (s) => ({ ...s, tags: JSON.stringify(normalizeTags(s.tags)) }),
  sort: (a, b) => a.title.localeCompare(b.title),
});

export const japanese = localCrudRoutes({
  table: "japanese_log",
  input: japaneseLogInput,
  patch: japaneseLogPatch,
  label: "log entry",
  decode: (r): JapaneseLogEntry => ({ ...r, kind: r.kind as JapaneseKind }),
  encode: (e) => e,
  sort: (a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt),
  list: (items, query) => {
    const { from, to } = dateRangeQuery.parse(query);
    return items.filter((e) => (!from || e.date >= from) && (!to || e.date <= to));
  },
});
