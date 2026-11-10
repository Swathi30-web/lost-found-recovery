import axios from 'axios';
import { useEffect, useState } from 'react';
import type * as T from './types';

/* ---------- HTTP (Axios -> JSON Server) ---------- */

export const http = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    'https://lost-found-recovery.onrender.com',
  timeout: 15000,
});

export const get = async <R>(
  url: string,
  params?: Record<string, unknown>
): Promise<R> => {
  const response = await http.get<R>(url, { params });
  return response.data;
};

export const post = async <R>(
  url: string,
  body: object
): Promise<R> => {
  const response = await http.post<R>(url, body);
  return response.data;
};

export const patch = async <R>(
  url: string,
  body: object
): Promise<R> => {
  const response = await http.patch<R>(url, body);
  return response.data;
};

export const del = (url: string) => http.delete(url);

/* ---------- Error Handling ---------- */

export const errMsg = (e: unknown): string => {
  if (axios.isAxiosError(e)) {
    if (e.response) {
      return `Server error (${e.response.status}). Please try again.`;
    }

    if (e.request) {
      return 'Cannot reach the server. Please check whether the API server is running.';
    }

    return e.message;
  }

  if (e instanceof Error) {
    return e.message;
  }

  return 'Something went wrong.';
};

/* ---------- Date Helpers ---------- */

export const now = (): string => {
  return new Date().toISOString();
};

export const today = (): string => {
  return new Date().toISOString().slice(0, 10);
};

export const fmt = (d?: string | null): string => {
  if (!d) return '—';

  return new Date(d).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: d.length > 10 ? 'short' : undefined,
  });
};

/* ---------- Data Hook ---------- */

export function useFetch<R>(
  fn: () => Promise<R>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<R | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;

    setLoading(true);
    setError('');

    fn()
      .then((result) => {
        if (live) {
          setData(result);
        }
      })
      .catch((e) => {
        if (live) {
          setError(errMsg(e));
        }
      })
      .finally(() => {
        if (live) {
          setLoading(false);
        }
      });

    return () => {
      live = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return {
    data,
    loading,
    error,
    reload: () => setTick((t) => t + 1),
  };
}

/* ---------- Activity Log + Notifications ---------- */

export const logActivity = (
  entityType: T.Activity['entityType'],
  entityId: number,
  action: string,
  actorId: number,
  note = ''
) =>
  post('/activityLogs', {
    entityType,
    entityId,
    action,
    actorId,
    note,
    createdAt: now(),
  });

export const notify = (
  userId: number,
  type: T.Notification['type'],
  message: string,
  link: string
) =>
  post('/notifications', {
    userId,
    type,
    message,
    link,
    read: false,
    createdAt: now(),
  });

export async function notifyStaff(
  type: T.Notification['type'],
  message: string,
  link: string
) {
  const users = await get<T.User[]>('/users');

  const staff = users.filter(
    (user) => user.role !== 'user' && user.active !== false
  );

  await Promise.all(
    staff.map((user) =>
      notify(user.id, type, message, link)
    )
  );
}

/* ---------- Search / Filter / Sort ---------- */

export interface Filters {
  q: string;
  category: string;
  location: string;
  date: string;
  status: string;
  sort: 'newest' | 'oldest';
}

export const emptyFilters: Filters = {
  q: '',
  category: '',
  location: '',
  date: '',
  status: '',
  sort: 'newest',
};

export interface Norm {
  name: string;
  cat: number;
  loc: string;
  date: string;
  status: string;
  created: string;
}

export const norm = (
  kind: 'lost' | 'found',
  item: any
): Norm => {
  if (kind === 'lost') {
    return {
      name: item.itemName,
      cat: item.categoryId,
      loc: item.lastSeenLocation,
      date: item.lastSeenDate,
      status: item.status,
      created: item.createdAt,
    };
  }

  return {
    name: item.itemName,
    cat: item.categoryId,
    loc: item.foundLocation,
    date: item.foundDate,
    status: item.status,
    created: item.createdAt,
  };
};

export function filterItems<X>(
  items: X[],
  filters: Filters,
  normalize: (item: X) => Norm
): X[] {
  const query = filters.q.trim().toLowerCase();
  const location = filters.location.trim().toLowerCase();

  return items
    .filter((item) => {
      const value = normalize(item);

      const matchesQuery =
        !query ||
        value.name.toLowerCase().includes(query);

      const matchesCategory =
        !filters.category ||
        String(value.cat) === filters.category;

      const matchesLocation =
        !location ||
        value.loc.toLowerCase().includes(location);

      const matchesDate =
        !filters.date ||
        value.date >= filters.date;

      const matchesStatus =
        !filters.status ||
        value.status === filters.status;

      return (
        matchesQuery &&
        matchesCategory &&
        matchesLocation &&
        matchesDate &&
        matchesStatus
      );
    })
    .sort((a, b) => {
      const comparison = normalize(a).created.localeCompare(
        normalize(b).created
      );

      return filters.sort === 'newest'
        ? -comparison
        : comparison;
    });
}

/* ---------- Matching ---------- */

const STOP = new Set([
  'the',
  'and',
  'with',
  'for',
  'near',
  'has',
  'was',
  'are',
  'from',
  'that',
  'this',
]);

const tok = (value: string): Set<string> => {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(
        (word) =>
          word.length > 2 &&
          !STOP.has(word)
      )
  );
};

export const MATCH_MIN = 55;

/**
 * Score: 0-100
 *
 * Category = 35
 * Keywords = up to 30
 * Location = 20
 * Date window = 15
 */
export function scoreMatch(
  lost: T.LostReport,
  found: T.FoundItem
): number {
  let score =
    lost.categoryId === found.categoryId
      ? 35
      : 0;

  const lostTokens = tok(
    `${lost.itemName} ${lost.description} ${lost.identifyingDetails}`
  );

  const foundTokens = tok(
    `${found.itemName} ${found.description}`
  );

  const commonKeywords = [...lostTokens].filter(
    (word) => foundTokens.has(word)
  );

  score += Math.min(
    30,
    commonKeywords.length * 10
  );

  const lostLocation = tok(
    lost.lastSeenLocation
  );

  const foundLocation = tok(
    found.foundLocation
  );

  const sameLocation = [...lostLocation].some(
    (word) => foundLocation.has(word)
  );

  if (sameLocation) {
    score += 20;
  }

  const days =
    (Date.parse(found.foundDate) -
      Date.parse(lost.lastSeenDate)) /
    86400000;

  if (days >= 0 && days <= 14) {
    score += 15;
  }

  return Math.min(100, score);
}

/* ---------- Generate Matches ---------- */

export async function generateMatches(
  kind: 'lost' | 'found',
  item: T.LostReport | T.FoundItem
) {
  const others =
    kind === 'lost'
      ? await get<T.FoundItem[]>('/foundItems')
      : await get<T.LostReport[]>('/lostReports');

  const existing =
    await get<T.Match[]>('/matchSuggestions');

  for (const other of others) {
    const lost =
      (kind === 'lost'
        ? item
        : other) as T.LostReport;

    const found =
      (kind === 'lost'
        ? other
        : item) as T.FoundItem;

    if (
      ['Returned', 'Closed'].includes(
        found.status
      ) ||
      ['Resolved', 'Closed'].includes(
        lost.status
      )
    ) {
      continue;
    }

    const score = scoreMatch(lost, found);

    const alreadyExists = existing.some(
      (match) =>
        match.lostId === lost.id &&
        match.foundId === found.id
    );

    if (
      score < MATCH_MIN ||
      alreadyExists
    ) {
      continue;
    }

    await post('/matchSuggestions', {
      lostId: lost.id,
      foundId: found.id,
      score,
      status: 'Suggested',
      decidedBy: null,
      createdAt: now(),
    });

    await notify(
      lost.userId,
      'match',
      `Possible match for "${lost.itemName}": found item "${found.itemName}" (${score}%).`,
      `/lost/${lost.id}`
    );
  }
}

/* ---------- Decide Match ---------- */

export async function decideMatch(
  match: T.Match,
  decision: 'Confirmed' | 'Dismissed',
  actor: T.User
) {
  await patch(
    `/matchSuggestions/${match.id}`,
    {
      status: decision,
      decidedBy: actor.id,
    }
  );

  if (decision !== 'Confirmed') {
    return;
  }

  const lost = await get<T.LostReport>(
    `/lostReports/${match.lostId}`
  );

  if (lost.status === 'Open') {
    await patch(
      `/lostReports/${lost.id}`,
      {
        status: 'Matched',
      }
    );
  }

  await logActivity(
    'lost',
    match.lostId,
    'Match confirmed',
    actor.id,
    `Matched with found item #${match.foundId}`
  );

  await logActivity(
    'found',
    match.foundId,
    'Match confirmed',
    actor.id,
    `Matched with lost report #${match.lostId}`
  );

  if (lost.userId !== actor.id) {
    await notify(
      lost.userId,
      'match',
      `A match for "${lost.itemName}" was confirmed. You can now submit a claim.`,
      `/found/${match.foundId}`
    );
  }
}

/* ---------- Claim + Handover Workflow ---------- */

export const ACTIVE_CLAIM: T.ClaimStatus[] = [
  'Submitted',
  'Under Review',
  'More Information Required',
];

/* ---------- Submit Claim ---------- */

export async function submitClaim(
  input: {
    foundId: number;
    lostId: number | null;
    identifyingDetails: string;
    proofNotes: string;
  },
  user: T.User
) {
  const [myClaims, found] = await Promise.all([
    get<T.Claim[]>('/claims', {
      foundId: input.foundId,
      userId: user.id,
    }),

    get<T.FoundItem>(
      `/foundItems/${input.foundId}`
    ),
  ]);

  if (
    myClaims.some(
      (claim) => claim.status !== 'Rejected'
    )
  ) {
    throw new Error(
      'You already have an active claim for this item.'
    );
  }

  if (
    !['In Storage', 'Claim Pending'].includes(
      found.status
    )
  ) {
    throw new Error(
      'This item is no longer available to claim.'
    );
  }

  const claim = await post<T.Claim>(
    '/claims',
    {
      ...input,
      userId: user.id,
      status: 'Submitted',
      infoRequest: '',
      createdAt: now(),
      updatedAt: now(),
    }
  );

  if (found.status === 'In Storage') {
    await patch(
      `/foundItems/${found.id}`,
      {
        status: 'Claim Pending',
      }
    );
  }

  await logActivity(
    'claim',
    claim.id,
    'Claim submitted',
    user.id
  );

  await logActivity(
    'found',
    found.id,
    'Claim submitted',
    user.id,
    `Claim #${claim.id}`
  );

  await notifyStaff(
    'claim',
    `New claim submitted for "${found.itemName}".`,
    '/queue'
  );

  await notify(
    user.id,
    'claim',
    `Your claim for "${found.itemName}" was submitted.`,
    '/claims'
  );

  return claim;
}

/* ---------- Respond to Information Request ---------- */

export async function respondToInfoRequest(
  claim: T.Claim,
  reply: string,
  user: T.User
) {
  const previousNotes =
    claim.proofNotes || '';

  await patch(
    `/claims/${claim.id}`,
    {
      proofNotes:
        `${previousNotes}\n[${fmt(now())}] ${reply}`,
      status: 'Under Review',
      updatedAt: now(),
    }
  );

  await logActivity(
    'claim',
    claim.id,
    'Information provided',
    user.id,
    reply
  );

  await notifyStaff(
    'claim',
    `Claim #${claim.id}: the claimant replied to your information request.`,
    '/queue'
  );
}

/* ---------- Review Claim ---------- */

export async function reviewClaim(
  claim: T.Claim,
  status: T.ClaimStatus,
  note: string,
  actor: T.User
) {
  const [allClaims, found] =
    await Promise.all([
      get<T.Claim[]>('/claims', {
        foundId: claim.foundId,
      }),

      get<T.FoundItem>(
        `/foundItems/${claim.foundId}`
      ),
    ]);

  if (
    status === 'Approved' &&
    allClaims.some(
      (item) =>
        item.id !== claim.id &&
        item.status === 'Approved'
    )
  ) {
    throw new Error(
      'Another claim for this item is already approved.'
    );
  }

  await patch(
    `/claims/${claim.id}`,
    {
      status,
      updatedAt: now(),
      infoRequest:
        status === 'More Information Required'
          ? note
          : claim.infoRequest ?? '',
    }
  );

  await post('/verifications', {
    claimId: claim.id,
    verifierId: actor.id,
    status,
    note,
    createdAt: now(),
  });

  await logActivity(
    'claim',
    claim.id,
    `Status: ${status}`,
    actor.id,
    note
  );

  const messages: Record<
    string,
    [T.Notification['type'], string]
  > = {
    'Under Review': [
      'claim',
      `Your claim for "${found.itemName}" is now under review.`,
    ],

    'More Information Required': [
      'info',
      `Staff needs more information for your claim on "${found.itemName}": ${note}`,
    ],

    Approved: [
      'handover',
      `Your claim for "${found.itemName}" is approved. It is being prepared for handover.`,
    ],

    Rejected: [
      'claim',
      `Your claim for "${found.itemName}" was rejected: ${note}`,
    ],
  };

  if (messages[status]) {
    await notify(
      claim.userId,
      messages[status][0],
      messages[status][1],
      '/claims'
    );
  }

  /* ---------- Approved Claim -> Handover ---------- */

  if (status === 'Approved') {
    const handover =
      await post<T.Handover>(
        '/handovers',
        {
          claimId: claim.id,
          foundId: claim.foundId,
          userId: claim.userId,
          status: 'Ready for Handover',
          verifierId: null,
          handoverDate: null,
          note: '',
          createdAt: now(),
        }
      );

    await logActivity(
      'handover',
      handover.id,
      'Ready for Handover',
      actor.id,
      `Claim #${claim.id}`
    );
  }

  /* ---------- Rejected Claim ---------- */

  if (
    status === 'Rejected' &&
    !allClaims.some(
      (item) =>
        item.id !== claim.id &&
        ACTIVE_CLAIM.includes(item.status)
    ) &&
    found.status === 'Claim Pending'
  ) {
    await patch(
      `/foundItems/${found.id}`,
      {
        status: 'In Storage',
      }
    );
  }
}

/* ---------- Complete Handover ---------- */

export async function completeHandover(
  handover: T.Handover,
  actor: T.User,
  date: string,
  verifierId: number,
  note: string
) {
  const claim = await get<T.Claim>(
    `/claims/${handover.claimId}`
  );

  await patch(
    `/handovers/${handover.id}`,
    {
      status: 'Handed Over',
      handoverDate: date,
      verifierId,
      note,
    }
  );

  await patch(
    `/foundItems/${handover.foundId}`,
    {
      status: 'Returned',
    }
  );

  if (claim.lostId) {
    await patch(
      `/lostReports/${claim.lostId}`,
      {
        status: 'Resolved',
      }
    );
  }

  await logActivity(
    'handover',
    handover.id,
    'Handed Over',
    actor.id,
    `On ${date}. ${note}`
  );

  await logActivity(
    'found',
    handover.foundId,
    'Item returned to owner',
    actor.id
  );

  await notify(
    handover.userId,
    'handover',
    'Your item has been handed over. Thank you!',
    '/claims'
  );
}

/* ---------- Close Handover ---------- */

export async function closeHandover(
  handover: T.Handover,
  actor: T.User
) {
  await patch(
    `/handovers/${handover.id}`,
    {
      status: 'Closed',
    }
  );

  await patch(
    `/foundItems/${handover.foundId}`,
    {
      status: 'Closed',
    }
  );

  await logActivity(
    'handover',
    handover.id,
    'Closed',
    actor.id
  );

  await notify(
    handover.userId,
    'handover',
    'Your handover case has been closed.',
    '/claims'
  );
}