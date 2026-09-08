'use server';

import {
  getRoomsCollection,
  getContestantsCollection,
  getQuestionsCollection,
  invalidateRoomState,
  Room,
  Contestant,
  Question,
} from '@/lib/db';
import { assertAdmin, loginAdmin, logoutAdmin, checkIsAdmin } from '@/lib/session';
import { loadAndCacheRoomState } from '@/lib/engine/roomEngine';

function notifyRoomChanged(canonicalId: string, code?: string | null) {
  invalidateRoomState(canonicalId, code);
  loadAndCacheRoomState(canonicalId).catch((err) => {
    console.error('Room engine broadcast error:', err);
  });
}

export async function authenticateAdmin(pin: string): Promise<boolean> {
  return loginAdmin(pin);
}

export async function logoutAdminAction(): Promise<void> {
  return logoutAdmin();
}

export async function checkAdminSessionAction(): Promise<boolean> {
  return checkIsAdmin();
}

// Helper to generate 6-character alphanumeric room codes
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper to resolve room by UUID, Code, _id, or exact name
export async function resolveRoom(codeOrIdOrName: string): Promise<Room | null> {
  const clean = codeOrIdOrName.trim();
  if (!clean) return null;
  const rooms = await getRoomsCollection();

  // 1. Check by ID, code, or _id
  let room = await rooms.findOne({
    $or: [
      { id: clean },
      { id: clean.toLowerCase() },
      { code: clean.toUpperCase() },
      { _id: clean },
    ],
  });
  if (room) return room;

  // 2. Check by exact name (case-insensitive)
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  room = await rooms.findOne({
    name: { $regex: `^${escaped}$`, $options: 'i' },
  });
  return room;
}

export async function getRoom(codeOrIdOrName: string): Promise<Room | null> {
  return resolveRoom(codeOrIdOrName);
}

// -------------------------------------------------------------
// ROOM & LOBBY ACTIONS
// -------------------------------------------------------------

export async function createRoom(name: string): Promise<Room> {
  await assertAdmin();

  const cleanName = name.trim() || 'Bluefox Quiz Room';
  const rooms = await getRoomsCollection();

  // If a room with this name or code or id already exists, reopen it without changing room ID!
  const existingRoom = await resolveRoom(cleanName);
  if (existingRoom) {
    return existingRoom;
  }

  let code = generateRoomCode();
  let existing = await rooms.findOne({ code });
  while (existing) {
    code = generateRoomCode();
    existing = await rooms.findOne({ code });
  }

  const id = crypto.randomUUID();
  const newRoom: Room = {
    id,
    _id: id,
    name: cleanName,
    code,
    status: 'lobby',
    roundType: 'normal',
    currentRoundName: 'Round 1: General Knowledge',
    customRounds: ['Round 1: General Knowledge', 'Round 2: Rapid Fire'],
    currentQuestionId: null,
    activeContestantId: null,
    timerEndsAt: null,
    timerSeconds: 30,
    passCount: 0,
    lastResult: null,
    revealedAnswer: null,
    rapidFireState: null,
    usedSets: [],
    setAssignments: {},
    rapidFireSeconds: 60,
    maxTeams: null,
    version: 1,
    createdAt: new Date(),
  };

  await rooms.insertOne(newRoom);
  return newRoom;
}

export async function joinRoom(
  codeOrId: string,
  groupName: string,
  rawMembers: string[] = [],
  clientClaimToken?: string | null
): Promise<{
  success: boolean;
  roomId?: string;
  contestantId?: string;
  groupName?: string;
  joinOrder?: number;
  claimToken?: string;
  error?: string;
  reconnected?: boolean;
}> {
  try {
    const cleanInput = codeOrId.trim();
    const room = await resolveRoom(cleanInput);

    if (!room) {
      return { success: false, error: 'Room not found. Please check the code or room ID.' };
    }

    const cleanGroupName = groupName.trim();
    if (!cleanGroupName) {
      return { success: false, error: 'Please enter a valid team name.' };
    }

    const contestants = await getContestantsCollection();
    const escapedGroup = cleanGroupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Check if this group already exists in the room
    const existingGroup = await contestants.findOne({
      roomId: { $in: [room.id, room.code] },
      kind: 'group',
      name: { $regex: `^${escapedGroup}$`, $options: 'i' },
    });

    if (existingGroup) {
      const isStale =
        !existingGroup.lastActiveAt ||
        Date.now() - new Date(existingGroup.lastActiveAt).getTime() > 5 * 60 * 1000;
      const canReclaim =
        !existingGroup.claimToken ||
        (clientClaimToken && clientClaimToken === existingGroup.claimToken) ||
        isStale ||
        room.status === 'lobby' ||
        room.status === 'finished';

      if (canReclaim) {
        const newClaimToken =
          existingGroup.claimToken && clientClaimToken === existingGroup.claimToken
            ? existingGroup.claimToken
            : crypto.randomUUID();

        await contestants.updateOne(
          { id: existingGroup.id },
          { $set: { claimToken: newClaimToken, lastActiveAt: new Date() } }
        );

        return {
          success: true,
          roomId: room.id,
          contestantId: existingGroup.id,
          groupName: existingGroup.name,
          joinOrder: existingGroup.joinOrder,
          claimToken: newClaimToken,
          reconnected: true,
        };
      }

      // Another device is actively using this team right now!
      return {
        success: false,
        error: `Team "${existingGroup.name}" is currently active on another device. Please log out from that device or wait a moment to rejoin.`,
      };
    }

    // If new group, make sure game is still in lobby
    if (room.status !== 'lobby') {
      return {
        success: false,
        error: 'This quiz is already in progress. If your team already registered, please make sure your team name matches exactly.',
      };
    }

    const existingGroups = await contestants
      .find({ roomId: { $in: [room.id, room.code] }, kind: 'group' })
      .toArray();

    const maxAllowed = room.maxTeams && room.maxTeams > 0 ? room.maxTeams : 64;
    if (existingGroups.length >= maxAllowed) {
      return { success: false, error: `Room is full (${maxAllowed} teams maximum).` };
    }

    const members = rawMembers
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    const id = crypto.randomUUID();
    const claimToken = crypto.randomUUID();
    const newContestant: Contestant = {
      id,
      _id: id,
      roomId: room.id,
      name: cleanGroupName,
      kind: 'group',
      parentGroupId: null,
      members,
      score: 0,
      joinOrder: existingGroups.length + 1,
      claimToken,
      lastActiveAt: new Date(),
      createdAt: new Date(),
    };

    await contestants.insertOne(newContestant);

    // Bump room version for polling detection
    const rooms = await getRoomsCollection();
    await rooms.updateOne({ id: room.id }, { $inc: { version: 1 } });

    return {
      success: true,
      roomId: room.id,
      contestantId: newContestant.id,
      groupName: newContestant.name,
      joinOrder: newContestant.joinOrder,
      claimToken,
    };
  } catch (err) {
    console.error('joinRoom action error:', err);
    return { success: false, error: (err as Error).message || 'Failed to join room' };
  }
}

export async function logoutContestant(
  roomId: string,
  contestantId: string,
  claimToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const room = await resolveRoom(roomId);
    if (!room) return { success: false, error: 'Room not found' };

    const contestants = await getContestantsCollection();
    const contestant = await contestants.findOne({
      id: contestantId,
      roomId: { $in: [room.id, room.code] },
    });

    if (!contestant) return { success: false, error: 'Team not found' };

    // Release the claim token so another device or session can take over
    await contestants.updateOne(
      { id: contestantId },
      { $set: { claimToken: null, lastActiveAt: null } }
    );

    const rooms = await getRoomsCollection();
    await rooms.updateOne({ id: room.id }, { $inc: { version: 1 } });

    return { success: true };
  } catch (err) {
    console.error('logoutContestant error:', err);
    return { success: false, error: (err as Error).message || 'Failed to logout team' };
  }
}

export async function checkRoomCapacity(codeOrId: string) {
  const clean = codeOrId.trim();
  if (clean.length < 2) return null;

  try {
    const room = await resolveRoom(clean);
    if (!room) return { exists: false };

    const contestants = await getContestantsCollection();
    const groups = await contestants
      .find({ roomId: { $in: [room.id, room.code] }, kind: 'group' })
      .sort({ joinOrder: 1 })
      .toArray();

    const maxGroups = room.maxTeams || null;
    const isFull = maxGroups !== null ? groups.length >= maxGroups : false;

    const registeredTeams = groups.map((g) => ({
      id: g.id,
      name: g.name,
      score: g.score,
      joinOrder: g.joinOrder,
      hasActiveSession: Boolean(g.claimToken),
    }));

    return {
      exists: true,
      roomId: room.id,
      code: room.code,
      name: room.name,
      status: room.status,
      groupCount: groups.length,
      maxGroups,
      isFull,
      registeredTeams,
    };
  } catch {
    return { exists: false };
  }
}

export async function getRoomRegisteredTeams(codeOrId: string) {
  const res = await checkRoomCapacity(codeOrId);
  return res && res.exists ? res.registeredTeams || [] : [];
}

export async function getAdminRooms(): Promise<Room[]> {
  await assertAdmin();
  const rooms = await getRoomsCollection();
  const list = await rooms.find({}).sort({ createdAt: -1 }).limit(30).toArray();
  return list.map((r) => ({
    ...r,
    _id: r.id,
    createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
  }));
}

export async function findRoomByIdOrCode(codeOrId: string): Promise<Room | null> {
  await assertAdmin();
  const room = await resolveRoom(codeOrId);
  if (!room) return null;
  return {
    ...room,
    _id: room.id,
    createdAt: room.createdAt ? new Date(room.createdAt) : new Date(),
  };
}

export async function adminAddGroup(
  roomId: string,
  groupName: string,
  rawMembers: string[] = []
): Promise<Contestant> {
  await assertAdmin();

  const room = await resolveRoom(roomId);
  if (!room) throw new Error('Room not found');
  const canonicalId = room.id;
  const cleanName = groupName.trim();
  if (!cleanName) throw new Error('Group name cannot be empty');

  const contestants = await getContestantsCollection();
  const roomIds = [canonicalId, room?.code].filter(Boolean) as string[];
  const existingGroups = await contestants
    .find({ roomId: { $in: roomIds }, kind: 'group' })
    .toArray();

  // If room has an explicit maxTeams limit and it is reached, auto-expand it for host
  if (room.maxTeams && existingGroups.length >= room.maxTeams) {
    const roomsColl = await getRoomsCollection();
    await roomsColl.updateOne(
      { id: canonicalId },
      { $set: { maxTeams: existingGroups.length + 1 } }
    );
  }

  const members = rawMembers.map((m) => m.trim()).filter((m) => m.length > 0);
  const id = crypto.randomUUID();
  const newGroup: Contestant = {
    id,
    _id: id,
    roomId: canonicalId,
    name: cleanName,
    kind: 'group',
    parentGroupId: null,
    members,
    score: 0,
    joinOrder: existingGroups.length + 1,
    createdAt: new Date(),
  };

  await contestants.insertOne(newGroup);

  const rooms = await getRoomsCollection();
  await rooms.updateOne({ id: canonicalId }, { $inc: { version: 1 } });

  return newGroup;
}

export async function setRoomMaxTeams(
  roomId: string,
  maxTeams: number | null
): Promise<{ success: boolean; maxTeams: number | null }> {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return { success: false, maxTeams: null };
  const canonicalId = room.id;

  const validMax = maxTeams && maxTeams > 0 ? Math.max(2, Math.floor(maxTeams)) : null;
  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: { maxTeams: validMax },
      $inc: { version: 1 },
    }
  );

  return { success: true, maxTeams: validMax };
}

export async function deleteRoom(roomId: string): Promise<{ success: boolean }> {
  await assertAdmin();

  const room = await resolveRoom(roomId);
  const canonicalId = room ? room.id : roomId;
  const roomIds = [canonicalId, room?.code].filter(Boolean) as string[];

  const rooms = await getRoomsCollection();
  const contestants = await getContestantsCollection();
  const questions = await getQuestionsCollection();

  await rooms.deleteMany({ id: { $in: roomIds } });
  await contestants.deleteMany({ roomId: { $in: roomIds } });
  await questions.deleteMany({ roomId: { $in: roomIds } });

  return { success: true };
}

export async function adminRemoveGroup(roomId: string, contestantId: string) {
  await assertAdmin();

  const room = await resolveRoom(roomId);
  const canonicalId = room ? room.id : roomId;
  const roomIds = [canonicalId, room?.code].filter(Boolean) as string[];

  const contestants = await getContestantsCollection();
  await contestants.deleteOne({ id: contestantId, roomId: { $in: roomIds } });
  await contestants.deleteMany({ parentGroupId: contestantId });

  // Re-index remaining groups joinOrder (1..N)
  const remainingGroups = await contestants
    .find({ roomId: { $in: roomIds }, kind: 'group' })
    .sort({ joinOrder: 1 })
    .toArray();

  for (let i = 0; i < remainingGroups.length; i++) {
    await contestants.updateOne(
      { id: remainingGroups[i].id },
      { $set: { joinOrder: i + 1 } }
    );
  }

  const rooms = await getRoomsCollection();
  const currentRoom = await rooms.findOne({ id: canonicalId });
  if (currentRoom && currentRoom.activeContestantId === contestantId) {
    await rooms.updateOne(
      { id: canonicalId },
      {
        $set: {
          activeContestantId: remainingGroups.length > 0 ? remainingGroups[0].id : null,
          passCount: 0,
          timerEndsAt: null,
        },
        $inc: { version: 1 },
      }
    );
  } else {
    await rooms.updateOne({ id: canonicalId }, { $inc: { version: 1 } });
  }
}

export async function setRound(roomId: string, roundType: 'normal' | 'rapid_fire') {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        roundType,
        currentQuestionId: null,
        timerEndsAt: null,
        lastResult: null,
        passCount: 0,
      },
      $inc: { version: 1 },
    }
  );
}

export async function setRoomActiveRound(
  roomId: string,
  roundName: string | null,
  roundType?: 'normal' | 'rapid_fire'
) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;
  const cleanName = roundName?.trim() || null;

  let newRoundType = roundType;
  if (!newRoundType) {
    if (cleanName && /rapid/i.test(cleanName)) {
      newRoundType = 'rapid_fire';
    } else if (cleanName) {
      newRoundType = 'normal';
    } else {
      newRoundType = room.roundType;
    }
  }

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        currentRoundName: cleanName,
        roundType: newRoundType,
        currentQuestionId: null,
        timerEndsAt: null,
        lastResult: null,
        passCount: 0,
      },
      $inc: { version: 1 },
    }
  );
}

export async function addRoomRound(roomId: string, roundName: string): Promise<string[]> {
  await assertAdmin();
  const clean = roundName.trim();
  if (!clean) throw new Error('Round name cannot be empty');

  const room = await resolveRoom(roomId);
  if (!room) throw new Error('Room not found');

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: room.id },
    {
      $addToSet: { customRounds: clean },
      $inc: { version: 1 },
    }
  );

  const updated = await rooms.findOne({ id: room.id });
  return updated?.customRounds || [];
}

export async function deleteRoomRound(roomId: string, roundName: string): Promise<string[]> {
  await assertAdmin();
  const clean = roundName.trim();
  const room = await resolveRoom(roomId);
  if (!room) throw new Error('Room not found');

  const rooms = await getRoomsCollection();
  const updateDoc: Record<string, unknown> = {
    $pull: { customRounds: clean },
    $inc: { version: 1 },
  };
  if (room.currentRoundName === clean) {
    updateDoc.$set = { currentRoundName: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await rooms.updateOne({ id: room.id }, updateDoc as any);
  const updated = await rooms.findOne({ id: room.id });
  return updated?.customRounds || [];
}

export async function startGame(roomId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const contestants = await getContestantsCollection();
  const firstGroup = await contestants.findOne(
    { roomId: { $in: [canonicalId, room.code] }, kind: 'group' },
    { sort: { joinOrder: 1 } }
  );

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        status: 'playing',
        activeContestantId: firstGroup ? firstGroup.id : null,
        timerEndsAt: null,
        lastResult: null,
        passCount: 0,
      },
      $inc: { version: 1 },
    }
  );
  notifyRoomChanged(canonicalId, room.code);
}

export async function finishGame(roomId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        status: 'finished',
        timerEndsAt: null,
      },
      $inc: { version: 1 },
    }
  );
  notifyRoomChanged(canonicalId, room.code);
}

export async function resetGame(roomId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;
  const roomIds = [canonicalId, room.code];

  const [rooms, contestants, questions] = await Promise.all([
    getRoomsCollection(),
    getContestantsCollection(),
    getQuestionsCollection(),
  ]);

  await Promise.all([
    rooms.updateOne(
      { id: canonicalId },
      {
        $set: {
          status: 'lobby',
          currentQuestionId: null,
          activeContestantId: null,
          timerEndsAt: null,
          passCount: 0,
          lastResult: null,
          revealedAnswer: null,
          rapidFireState: null,
          usedSets: [],
          setAssignments: {},
          roundType: 'normal',
        },
        $inc: { version: 1 },
      }
    ),
    contestants.updateMany({ roomId: { $in: roomIds } }, { $set: { score: 0 } }),
    questions.updateMany({ roomId: { $in: roomIds } }, { $set: { status: 'unused', answeredBy: null } }),
  ]);
  notifyRoomChanged(canonicalId, room.code);
}

// -------------------------------------------------------------
// GAME ENGINE ACTIONS
// -------------------------------------------------------------

export async function showQuestion(roomId: string, questionId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const [questions, rooms] = await Promise.all([
    getQuestionsCollection(),
    getRoomsCollection(),
  ]);

  await Promise.all([
    questions.updateOne({ id: questionId }, { $set: { status: 'active' } }),
    rooms.updateOne(
      { id: canonicalId },
      {
        $set: {
          currentQuestionId: questionId,
          passCount: 0,
          lastResult: null,
          revealedAnswer: null,
          timerEndsAt: null,
        },
        $inc: { version: 1 },
      }
    ),
  ]);
  notifyRoomChanged(canonicalId, room.code);
}

export async function startTimer(roomId: string, customSeconds?: number) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  let duration = customSeconds;
  if (!duration && room.currentQuestionId) {
    const questions = await getQuestionsCollection();
    const q = await questions.findOne({ id: room.currentQuestionId });
    if (q?.timerSeconds) {
      duration = q.timerSeconds;
    }
  }

  if (!duration) {
    duration = room.timerSeconds || 30;
  }

  const timerEndsAt = new Date(Date.now() + duration * 1000);

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: { timerEndsAt },
      $inc: { version: 1 },
    }
  );
  notifyRoomChanged(canonicalId, room.code);
}

export async function stopTimer(roomId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: { timerEndsAt: null },
      $inc: { version: 1 },
    }
  );
  notifyRoomChanged(canonicalId, room.code);
}

export async function setRoomTimerDefault(roomId: string, seconds: number) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: { timerSeconds: seconds },
      $inc: { version: 1 },
    }
  );
  notifyRoomChanged(canonicalId, room.code);
}

export async function markCorrect(
  roomId: string,
  targetContestantId?: string
): Promise<{
  success: boolean;
  pointsAwarded?: number;
  contestantName?: string;
  revealedAnswer?: string;
  error?: string;
}> {
  await assertAdmin();

  const room = await resolveRoom(roomId);
  if (!room || !room.currentQuestionId) {
    return { success: false, error: 'No active question found' };
  }
  const canonicalId = room.id;

  const questions = await getQuestionsCollection();
  const question = await questions.findOne({ id: room.currentQuestionId });
  if (!question) {
    return { success: false, error: 'Question not found' };
  }

  const contestants = await getContestantsCollection();
  const recipientId = targetContestantId || room.activeContestantId;
  if (!recipientId) {
    return { success: false, error: 'No active contestant to award points' };
  }

  // RAPID FIRE GUARD: In rapid fire mode, host marking correct submits the answer for the active team and advances set
  if (room.roundType === 'rapid_fire') {
    return submitAnswer(canonicalId, recipientId, question.correctAnswer);
  }

  const contestant = await contestants.findOne({ id: recipientId });
  if (!contestant) {
    return { success: false, error: 'Contestant not found' };
  }

  // Award points: auto add question.points
  const points = question.points ?? 10;
  const rooms = await getRoomsCollection();

  const updatePromises: Promise<unknown>[] = [
    contestants.updateOne(
      { id: contestant.id },
      { $set: { score: contestant.score + points } }
    ),
    questions.updateOne(
      { id: question.id },
      { $set: { status: 'done', answeredBy: contestant.id } }
    ),
    rooms.updateOne(
      { id: canonicalId },
      {
        $set: {
          lastResult: 'correct',
          revealedAnswer: question.correctAnswer,
          timerEndsAt: null,
        },
        $inc: { version: 1 },
      }
    ),
  ];

  // If this contestant is an individual in rapid fire, award points to parent group directly too
  if (contestant.kind === 'individual' && contestant.parentGroupId) {
    updatePromises.push(
      contestants.updateOne(
        { id: contestant.parentGroupId },
        { $inc: { score: points } }
      )
    );
  }

  await Promise.all(updatePromises);
  notifyRoomChanged(canonicalId, room.code);

  return {
    success: true,
    pointsAwarded: points,
    contestantName: contestant.name,
    revealedAnswer: question.correctAnswer,
  };
}

export async function markWrong(roomId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  // RAPID FIRE GUARD: In rapid fire mode, wrong answer skips to next question in active set (NO passing to other teams)
  if (room.roundType === 'rapid_fire') {
    if (room.activeContestantId) {
      await skipRapidFireQuestion(canonicalId, room.activeContestantId);
    }
    return;
  }

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: { lastResult: 'wrong' },
      $inc: { version: 1 },
    }
  );
  notifyRoomChanged(canonicalId, room.code);
}

export async function passQuestion(roomId: string) {
  const room = await resolveRoom(roomId);
  if (!room || !room.currentQuestionId) return;
  const canonicalId = room.id;

  // RAPID FIRE GUARD: In rapid fire mode, questions NEVER pass to other teams!
  // It immediately skips to the next question within the active team's set
  if (room.roundType === 'rapid_fire') {
    if (room.activeContestantId) {
      await skipRapidFireQuestion(canonicalId, room.activeContestantId);
    }
    return { closed: false, rapidFireAdvanced: true };
  }

  const contestants = await getContestantsCollection();
  const groups = await contestants
    .find({ roomId: { $in: [canonicalId, room.code] }, kind: 'group' })
    .sort({ joinOrder: 1 })
    .toArray();

  if (groups.length === 0) return;

  // If all groups have had their chance, close the question with revealed answer
  if (room.passCount >= groups.length - 1) {
    const [questions, rooms] = await Promise.all([
      getQuestionsCollection(),
      getRoomsCollection(),
    ]);
    const q = await questions.findOne({ id: room.currentQuestionId });
    await Promise.all([
      questions.updateOne(
        { id: room.currentQuestionId },
        { $set: { status: 'done' } }
      ),
      rooms.updateOne(
        { id: canonicalId },
        {
          $set: {
            timerEndsAt: null,
            lastResult: 'wrong',
            revealedAnswer: q?.correctAnswer || null,
          },
          $inc: { version: 1 },
        }
      ),
    ]);
    notifyRoomChanged(canonicalId, room.code);
    return { closed: true, revealedAnswer: q?.correctAnswer || null };
  }

  // Find next group in rotation
  const currentIndex = groups.findIndex((g) => g.id === room.activeContestantId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % groups.length;
  const nextGroup = groups[nextIndex];

  // Passed questions get a 15-second timer
  const timerEndsAt = new Date(Date.now() + 15_000);

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        activeContestantId: nextGroup.id,
        passCount: room.passCount + 1,
        timerEndsAt,
        lastResult: null,
      },
      $inc: { version: 1 },
    }
  );
  notifyRoomChanged(canonicalId, room.code);

  return { nextContestantId: nextGroup.id, passCount: room.passCount + 1 };
}

export async function nextTurn(roomId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const contestants = await getContestantsCollection();
  const groups = await contestants
    .find({ roomId: { $in: [canonicalId, room.code] }, kind: 'group' })
    .sort({ joinOrder: 1 })
    .toArray();

  if (groups.length === 0) return;

  if (room.roundType === 'rapid_fire') {
    const nextGroup = await getNextRapidFireContestantId(
      canonicalId,
      room.code,
      room.activeContestantId,
      room.setAssignments
    );
    const rooms = await getRoomsCollection();
    await rooms.updateOne(
      { id: canonicalId },
      {
        $set: {
          activeContestantId: nextGroup,
          passCount: 0,
          lastResult: null,
          currentQuestionId: null,
          timerEndsAt: null,
          rapidFireState: null,
        },
        $inc: { version: 1 },
      }
    );
    notifyRoomChanged(canonicalId, room.code);
    return;
  }

  const currentIndex = groups.findIndex((g) => g.id === room.activeContestantId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % groups.length;
  const nextGroup = groups[nextIndex];

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        activeContestantId: nextGroup.id,
        passCount: 0,
        lastResult: null,
      },
      $inc: { version: 1 },
    }
  );
  notifyRoomChanged(canonicalId, room.code);
}

export async function closeQuestion(roomId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room || !room.currentQuestionId) return;
  const canonicalId = room.id;

  const [questions, rooms] = await Promise.all([
    getQuestionsCollection(),
    getRoomsCollection(),
  ]);

  await Promise.all([
    questions.updateOne(
      { id: room.currentQuestionId },
      { $set: { status: 'done' } }
    ),
    rooms.updateOne(
      { id: canonicalId },
      {
        $set: {
          currentQuestionId: null,
          timerEndsAt: null,
          lastResult: null,
          revealedAnswer: null,
          passCount: 0,
        },
        $inc: { version: 1 },
      }
    ),
  ]);

  notifyRoomChanged(canonicalId, room.code);
}

export async function revealQuestionAnswer(roomId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room || !room.currentQuestionId) return;
  const canonicalId = room.id;

  const questions = await getQuestionsCollection();
  const question = await questions.findOne({ id: room.currentQuestionId });
  if (!question) return;

  await questions.updateOne(
    { id: question.id },
    { $set: { status: 'done' } }
  );

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        timerEndsAt: null,
        lastResult: null,
        revealedAnswer: question.correctAnswer,
      },
      $inc: { version: 1 },
    }
  );
}

export async function proceedToNextNumber(roomId: string) {
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        currentQuestionId: null,
        timerEndsAt: null,
        lastResult: null,
        revealedAnswer: null,
        passCount: 0,
      },
      $inc: { version: 1 },
    }
  );
}

export async function chooseNormalQuestion(
  roomId: string,
  questionId: string,
  customDuration?: number
) {
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const questions = await getQuestionsCollection();
  const question = await questions.findOne({ id: questionId });
  if (!question || question.status === 'done') return;

  const duration =
    customDuration ?? question.timerSeconds ?? room.timerSeconds ?? 30;
  const timerEndsAt = new Date(Date.now() + duration * 1000);

  const rooms = await getRoomsCollection();

  await Promise.all([
    questions.updateOne(
      { id: questionId },
      { $set: { status: 'active' } }
    ),
    rooms.updateOne(
      { id: canonicalId },
      {
        $set: {
          currentQuestionId: questionId,
          timerEndsAt,
          lastResult: null,
          revealedAnswer: null,
          passCount: 0,
        },
        $inc: { version: 1 },
      }
    ),
  ]);

  notifyRoomChanged(canonicalId, room.code);
}

function normalizeAnswer(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '')
    .replace(/\s+/g, ' ');
}

function isAnswerCorrect(userAns: string, correctAns: string, qtype: string): boolean {
  const cleanUser = userAns.trim();
  const cleanCorrect = correctAns.trim();
  if (!cleanUser || !cleanCorrect) return false;

  if (cleanUser.toLowerCase() === cleanCorrect.toLowerCase()) return true;

  const normUser = normalizeAnswer(cleanUser);
  const normCorrect = normalizeAnswer(cleanCorrect);
  if (normUser === normCorrect) return true;

  if (qtype === 'mcq') {
    if (normUser === normCorrect) return true;
  }

  const stripMount = (s: string) => s.replace(/\b(mount|mt)\b/gi, '').trim();
  if (normalizeAnswer(stripMount(cleanUser)) === normalizeAnswer(stripMount(cleanCorrect))) {
    return true;
  }

  return false;
}

// Helper to determine the next team eligible to choose a Rapid Fire set
export async function getNextRapidFireContestantId(
  canonicalId: string,
  roomCode?: string | null,
  currentContestantId?: string | null,
  setAssignments?: Record<string, string>
): Promise<string | null> {
  const contestants = await getContestantsCollection();
  const roomIds = [canonicalId, roomCode].filter(Boolean) as string[];
  const groups = await contestants
    .find({ roomId: { $in: roomIds }, kind: 'group' })
    .sort({ joinOrder: 1 })
    .toArray();

  if (groups.length === 0) return null;
  if (groups.length === 1) return groups[0].id;

  const currentIdx = groups.findIndex((g) => g.id === currentContestantId);
  const playedTeamIds = new Set(Object.values(setAssignments || {}));

  // Find the next group in joinOrder that has not played a Rapid Fire set yet
  for (let offset = 1; offset <= groups.length; offset++) {
    const candidate = groups[(currentIdx + offset) % groups.length];
    if (!playedTeamIds.has(candidate.id)) {
      return candidate.id;
    }
  }

  // If all groups have played, default to the next in rotation
  return groups[(currentIdx + 1) % groups.length].id;
}

export async function submitAnswer(
  roomId: string,
  contestantId: string,
  rawAnswer: string
): Promise<{
  success: boolean;
  correct?: boolean;
  pointsAwarded?: number;
  contestantName?: string;
  revealedAnswer?: string;
  passed?: boolean;
  nextContestantId?: string;
  allPassed?: boolean;
  completed?: boolean;
  error?: string;
}> {
  const cleanAnswer = rawAnswer.trim();
  if (!cleanAnswer) {
    return { success: false, error: 'Please enter an answer.' };
  }

  const room = await resolveRoom(roomId);
  if (!room) return { success: false, error: 'Room not found.' };
  const canonicalId = room.id;
  const roomIds = [canonicalId, room.code].filter(Boolean) as string[];

  // 1. RAPID FIRE MODE ANSWER SUBMISSION
  if (room.roundType === 'rapid_fire') {
    if (!room.rapidFireState || room.rapidFireState.status !== 'running') {
      return { success: false, error: 'Rapid Fire round is not active.' };
    }
    if (
      room.activeContestantId !== contestantId &&
      room.rapidFireState.contestantId !== contestantId
    ) {
      return { success: false, error: 'It is not your turn.' };
    }
    if (!room.timerEndsAt || new Date() > new Date(room.timerEndsAt)) {
      await finishRapidFireSet(canonicalId);
      return { success: false, error: 'Rapid Fire timeline has expired!' };
    }

    const questions = await getQuestionsCollection();
    const currentQ = room.currentQuestionId
      ? await questions.findOne({ id: room.currentQuestionId })
      : null;

    if (!currentQ) {
      return { success: false, error: 'No active question found in current set.' };
    }

    const contestants = await getContestantsCollection();
    const contestant = await contestants.findOne({ id: contestantId });
    if (!contestant) return { success: false, error: 'Contestant not found.' };

    const isCorrect = isAnswerCorrect(cleanAnswer, currentQ.correctAnswer, currentQ.qtype);
    const points = currentQ.points || 10;

    let newCorrectCount = room.rapidFireState.correctCount;
    let newScoreEarned = room.rapidFireState.scoreEarned;

    if (isCorrect) {
      newCorrectCount += 1;
      newScoreEarned += points;
      await contestants.updateOne(
        { id: contestant.id },
        { $inc: { score: points } }
      );
      if (contestant.kind === 'individual' && contestant.parentGroupId) {
        await contestants.updateOne(
          { id: contestant.parentGroupId },
          { $inc: { score: points } }
        );
      }
    }

    await questions.updateOne(
      { id: currentQ.id },
      { $set: { status: 'done', answeredBy: isCorrect ? contestant.id : null } }
    );

    const rfFilter: Record<string, unknown> = {
      roomId: { $in: roomIds },
      roundType: 'rapid_fire',
      setName: room.rapidFireState.activeSet,
    };
    if (room.currentRoundName) {
      const inRound = await questions.countDocuments({
        ...rfFilter,
        roundName: room.currentRoundName,
      });
      if (inRound > 0) {
        rfFilter.roundName = room.currentRoundName;
      }
    }

    const setQuestions = await questions
      .find(rfFilter)
      .sort({ number: 1 })
      .toArray();

    const nextIndex = room.rapidFireState.questionIndex + 1;
    const rooms = await getRoomsCollection();

    if (nextIndex < setQuestions.length) {
      const nextQ = setQuestions[nextIndex];
      await questions.updateOne({ id: nextQ.id }, { $set: { status: 'active' } });

      await rooms.updateOne(
        { id: canonicalId },
        {
          $set: {
            currentQuestionId: nextQ.id,
            lastResult: isCorrect ? 'correct' : 'wrong',
            'rapidFireState.questionIndex': nextIndex,
            'rapidFireState.correctCount': newCorrectCount,
            'rapidFireState.scoreEarned': newScoreEarned,
          },
          $inc: { version: 1 },
        }
      );

      notifyRoomChanged(canonicalId, room.code);

      return {
        success: true,
        correct: isCorrect,
        pointsAwarded: isCorrect ? points : 0,
        contestantName: contestant.name,
      };
    } else {
      // Set complete: determine next eligible team in rotation
      const nextTeamId = await getNextRapidFireContestantId(
        canonicalId,
        room.code,
        contestant.id,
        room.setAssignments
      );

      await rooms.updateOne(
        { id: canonicalId },
        {
          $set: {
            currentQuestionId: null,
            timerEndsAt: null,
            lastResult: 'correct',
            activeContestantId: nextTeamId,
            'rapidFireState.status': 'completed',
            'rapidFireState.correctCount': newCorrectCount,
            'rapidFireState.scoreEarned': newScoreEarned,
          },
          $inc: { version: 1 },
        }
      );

      notifyRoomChanged(canonicalId, room.code);

      return {
        success: true,
        correct: isCorrect,
        completed: true,
        pointsAwarded: isCorrect ? points : 0,
        contestantName: contestant.name,
      };
    }
  }

  // 2. NORMAL QUIZ MODE ANSWER SUBMISSION
  if (room.activeContestantId !== contestantId) {
    return { success: false, error: 'It is not your turn to answer!' };
  }
  if (!room.currentQuestionId) {
    return { success: false, error: 'No active question.' };
  }
  if (!room.timerEndsAt || new Date() > new Date(room.timerEndsAt)) {
    return { success: false, error: 'Time has expired for this question!' };
  }

  const questions = await getQuestionsCollection();
  const question = await questions.findOne({ id: room.currentQuestionId });
  if (!question) {
    return { success: false, error: 'Question not found.' };
  }

  const contestants = await getContestantsCollection();
  const contestant = await contestants.findOne({ id: contestantId });
  if (!contestant) {
    return { success: false, error: 'Contestant not found.' };
  }

  const isCorrect = isAnswerCorrect(cleanAnswer, question.correctAnswer, question.qtype);

  if (isCorrect) {
    const points = question.points || 10;
    await contestants.updateOne(
      { id: contestant.id },
      { $inc: { score: points } }
    );
    if (contestant.kind === 'individual' && contestant.parentGroupId) {
      await contestants.updateOne(
        { id: contestant.parentGroupId },
        { $inc: { score: points } }
      );
    }

    await questions.updateOne(
      { id: question.id },
      { $set: { status: 'done', answeredBy: contestant.id } }
    );

    // Rotate active turn to next group for subsequent question choice
    const allGroups = await contestants
      .find({ roomId: { $in: roomIds }, kind: 'group' })
      .sort({ joinOrder: 1 })
      .toArray();
    let nextTurnContestantId = contestant.id;
    if (allGroups.length > 1) {
      const idx = allGroups.findIndex((g) => g.id === contestant.id);
      const nextIdx = idx === -1 ? 0 : (idx + 1) % allGroups.length;
      nextTurnContestantId = allGroups[nextIdx].id;
    }

    const rooms = await getRoomsCollection();
    await rooms.updateOne(
      { id: canonicalId },
      {
        $set: {
          lastResult: 'correct',
          timerEndsAt: null,
          revealedAnswer: question.correctAnswer,
          activeContestantId: nextTurnContestantId,
        },
        $inc: { version: 1 },
      }
    );

    notifyRoomChanged(canonicalId, room.code);

    return {
      success: true,
      correct: true,
      pointsAwarded: points,
      contestantName: contestant.name,
      revealedAnswer: question.correctAnswer,
    };
  } else {
    // WRONG ANSWER: pass turn to next group in rotation
    const passResult = await passQuestion(canonicalId);
    if (passResult && 'closed' in passResult && passResult.closed) {
      return {
        success: true,
        correct: false,
        allPassed: true,
        revealedAnswer: question.correctAnswer,
      };
    }

    return {
      success: true,
      correct: false,
      passed: true,
      nextContestantId: passResult?.nextContestantId,
    };
  }
}

export async function adjustScore(contestantId: string, delta: number) {
  await assertAdmin();

  const contestants = await getContestantsCollection();
  const contestant = await contestants.findOne({ id: contestantId });
  if (!contestant) return;

  const newScore = Math.max(0, contestant.score + delta);
  await contestants.updateOne(
    { id: contestantId },
    { $set: { score: newScore } }
  );

  const room = await resolveRoom(contestant.roomId);
  if (room) {
    const rooms = await getRoomsCollection();
    await rooms.updateOne({ id: room.id }, { $inc: { version: 1 } });
    notifyRoomChanged(room.id, room.code);
  }
}

// -------------------------------------------------------------
// RAPID FIRE ACTIONS
// -------------------------------------------------------------

export async function selectRapidFireSet(
  roomId: string,
  setName: string,
  contestantId: string,
  timelineSeconds?: number
) {
  const cleanSetName = setName.trim();
  const room = await resolveRoom(roomId);
  if (!room) throw new Error('Room not found');
  const canonicalId = room.id;
  const roomIds = [canonicalId, room.code].filter(Boolean) as string[];

  // Resolve group ID if contestant is an individual
  const contestants = await getContestantsCollection();
  const contestant = await contestants.findOne({ id: contestantId });
  const effectiveGroupId =
    contestant?.kind === 'individual' && contestant.parentGroupId
      ? contestant.parentGroupId
      : contestantId;

  // Check if set is already taken
  if (room.usedSets && room.usedSets.includes(cleanSetName)) {
    throw new Error(`Set "${cleanSetName}" has already been chosen by another team.`);
  }

  // Check if this team has already played a set in this round
  if (room.setAssignments && Object.values(room.setAssignments).includes(effectiveGroupId)) {
    throw new Error(`Your team has already completed a Rapid Fire set in this round.`);
  }

  const questions = await getQuestionsCollection();
  const rfFilter: Record<string, unknown> = {
    roomId: { $in: roomIds },
    roundType: 'rapid_fire',
    setName: cleanSetName,
  };
  if (room.currentRoundName) {
    const inRound = await questions.countDocuments({
      ...rfFilter,
      roundName: room.currentRoundName,
    });
    if (inRound > 0) {
      rfFilter.roundName = room.currentRoundName;
    }
  }

  const setQuestions = await questions
    .find(rfFilter)
    .sort({ number: 1 })
    .toArray();

  if (setQuestions.length === 0) {
    throw new Error(`No questions found in "${cleanSetName}".`);
  }

  const duration = timelineSeconds || room.rapidFireSeconds || 60;
  const timerEndsAt = new Date(Date.now() + duration * 1000);

  // Set first question active
  await questions.updateOne({ id: setQuestions[0].id }, { $set: { status: 'active' } });

  const rapidFireState = {
    activeSet: cleanSetName,
    contestantId: effectiveGroupId,
    questionIndex: 0,
    totalQuestions: setQuestions.length,
    correctCount: 0,
    scoreEarned: 0,
    status: 'running' as const,
  };

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        roundType: 'rapid_fire',
        activeContestantId: effectiveGroupId,
        currentQuestionId: setQuestions[0].id,
        timerEndsAt,
        rapidFireState,
        lastResult: null,
        revealedAnswer: null,
        [`setAssignments.${cleanSetName}`]: effectiveGroupId,
      },
      $addToSet: { usedSets: cleanSetName },
      $inc: { version: 1 },
    }
  );

  notifyRoomChanged(canonicalId, room.code);

  return { success: true, rapidFireState };
}

export async function skipRapidFireQuestion(roomId: string, contestantId: string) {
  const room = await resolveRoom(roomId);
  if (!room || !room.rapidFireState || room.rapidFireState.status !== 'running') return;
  const canonicalId = room.id;
  const roomIds = [canonicalId, room.code].filter(Boolean) as string[];

  const questions = await getQuestionsCollection();
  if (room.currentQuestionId) {
    await questions.updateOne(
      { id: room.currentQuestionId },
      { $set: { status: 'done' } }
    );
  }

  const rfFilter: Record<string, unknown> = {
    roomId: { $in: roomIds },
    roundType: 'rapid_fire',
    setName: room.rapidFireState.activeSet,
  };
  if (room.currentRoundName) {
    const inRound = await questions.countDocuments({
      ...rfFilter,
      roundName: room.currentRoundName,
    });
    if (inRound > 0) {
      rfFilter.roundName = room.currentRoundName;
    }
  }

  const setQuestions = await questions
    .find(rfFilter)
    .sort({ number: 1 })
    .toArray();

  const nextIndex = room.rapidFireState.questionIndex + 1;
  const rooms = await getRoomsCollection();

  if (nextIndex < setQuestions.length) {
    const nextQ = setQuestions[nextIndex];
    await questions.updateOne({ id: nextQ.id }, { $set: { status: 'active' } });

    await rooms.updateOne(
      { id: canonicalId },
      {
        $set: {
          currentQuestionId: nextQ.id,
          lastResult: 'wrong',
          'rapidFireState.questionIndex': nextIndex,
        },
        $inc: { version: 1 },
      }
    );
  } else {
    // Set complete: determine next eligible team in rotation
    const nextTeamId = await getNextRapidFireContestantId(
      canonicalId,
      room.code,
      contestantId,
      room.setAssignments
    );

    await rooms.updateOne(
      { id: canonicalId },
      {
        $set: {
          currentQuestionId: null,
          timerEndsAt: null,
          lastResult: 'wrong',
          activeContestantId: nextTeamId,
          'rapidFireState.status': 'completed',
        },
        $inc: { version: 1 },
      }
    );
  }

  notifyRoomChanged(canonicalId, room.code);
}

export async function finishRapidFireSet(roomId: string) {
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const nextTeamId = await getNextRapidFireContestantId(
    canonicalId,
    room.code,
    room.activeContestantId,
    room.setAssignments
  );

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        currentQuestionId: null,
        timerEndsAt: null,
        activeContestantId: nextTeamId,
        'rapidFireState.status': 'completed',
      },
      $inc: { version: 1 },
    }
  );

  notifyRoomChanged(canonicalId, room.code);
}

export async function setRapidFireTimeLimit(roomId: string, seconds: number) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: room.id },
    {
      $set: { rapidFireSeconds: seconds },
      $inc: { version: 1 },
    }
  );

  notifyRoomChanged(room.id, room.code);
}

export async function startRapidFireForGroup(
  roomId: string,
  groupId: string
): Promise<Contestant | null> {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return null;
  const canonicalId = room.id;

  const contestants = await getContestantsCollection();
  const group = await contestants.findOne({
    id: groupId,
    roomId: { $in: [canonicalId, room.code] },
  });
  if (!group) return null;

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        roundType: 'rapid_fire',
        activeContestantId: group.id,
        currentQuestionId: null,
        timerEndsAt: null,
        lastResult: null,
        passCount: 0,
        rapidFireState: null,
      },
      $inc: { version: 1 },
    }
  );

  return group;
}

export async function startRapidFireForIndividual(
  roomId: string,
  parentGroupId: string,
  memberName: string
): Promise<Contestant | null> {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return null;
  const canonicalId = room.id;

  const contestants = await getContestantsCollection();

  let individual = await contestants.findOne({
    roomId: { $in: [canonicalId, room.code] },
    kind: 'individual',
    parentGroupId,
    name: memberName.trim(),
  });

  if (!individual) {
    const id = crypto.randomUUID();
    const created: Contestant = {
      id,
      _id: id,
      roomId: canonicalId,
      name: memberName.trim(),
      kind: 'individual',
      parentGroupId,
      members: [memberName.trim()],
      score: 0,
      joinOrder: 99,
      createdAt: new Date(),
    };
    await contestants.insertOne(created);
    individual = created;
  }

  const activeIndividual: Contestant = individual;

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        roundType: 'rapid_fire',
        activeContestantId: activeIndividual.id,
        currentQuestionId: null,
        timerEndsAt: null,
        lastResult: null,
        passCount: 0,
      },
      $inc: { version: 1 },
    }
  );

  return activeIndividual;
}

export async function chooseRapidFireQuestion(
  roomId: string,
  questionId: string,
  customDuration?: number
) {
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const questions = await getQuestionsCollection();
  const question = await questions.findOne({ id: questionId });
  if (!question || question.status === 'done') return;

  const duration =
    customDuration ?? question.timerSeconds ?? room.timerSeconds ?? 15;
  const timerEndsAt = new Date(Date.now() + duration * 1000);

  await questions.updateOne(
    { id: questionId },
    { $set: { status: 'active' } }
  );

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        currentQuestionId: questionId,
        timerEndsAt,
        lastResult: null,
        passCount: 0,
      },
      $inc: { version: 1 },
    }
  );
}

export async function creditIndividualToGroup(
  roomId: string,
  individualId: string
) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  const canonicalId = room ? room.id : roomId;

  const contestants = await getContestantsCollection();
  const individual = await contestants.findOne({ id: individualId });
  if (!individual || !individual.parentGroupId) return;

  const parentGroup = await contestants.findOne({ id: individual.parentGroupId });
  if (!parentGroup) return;

  await contestants.updateOne(
    { id: parentGroup.id },
    { $set: { score: parentGroup.score + individual.score } }
  );

  await contestants.updateOne(
    { id: individual.id },
    { $set: { score: 0 } }
  );

  const rooms = await getRoomsCollection();
  await rooms.updateOne({ id: canonicalId }, { $inc: { version: 1 } });
}

// -------------------------------------------------------------
// QUESTION EDITOR ACTIONS
// -------------------------------------------------------------

export interface CreateQuestionInput {
  roomId: string;
  roundType: 'normal' | 'rapid_fire';
  roundName?: string;
  setName?: string;
  number?: number;
  qtype: 'text' | 'mcq' | 'video' | 'audio';
  prompt: string;
  options?: string[];
  correctAnswer: string;
  mediaUrl?: string;
  points?: number;
  timerSeconds?: number;
}

export async function createQuestion(data: CreateQuestionInput): Promise<Question> {
  await assertAdmin();
  const room = await resolveRoom(data.roomId);
  const canonicalRoomId = room ? room.id : data.roomId;
  const roomIds = [canonicalRoomId, room?.code].filter(Boolean) as string[];

  const questions = await getQuestionsCollection();
  const cleanRoundName =
    data.roundName?.trim() ||
    room?.currentRoundName ||
    (data.roundType === 'rapid_fire' ? 'Round 2: Rapid Fire' : 'Round 1: General Knowledge');
  const cleanSetName = data.setName?.trim() || null;

  // Ensure room has this round recorded
  const roomsColl = await getRoomsCollection();
  await roomsColl.updateOne(
    { id: canonicalRoomId },
    {
      $addToSet: { customRounds: cleanRoundName },
      ...(!room?.currentRoundName ? { $set: { currentRoundName: cleanRoundName } } : {}),
    }
  );

  let qNumber = data.number;
  if (!qNumber) {
    if (data.roundType === 'rapid_fire') {
      if (cleanSetName) {
        const existingInSet = await questions
          .find({ roomId: { $in: roomIds }, roundType: 'rapid_fire', setName: cleanSetName })
          .toArray();
        qNumber = existingInSet.length + 1;
      } else {
        const existing = await questions
          .find({ roomId: { $in: roomIds }, roundType: 'rapid_fire' })
          .toArray();
        qNumber = existing.length + 1;
      }
    } else {
      // Normal round auto-number
      if (cleanRoundName) {
        const existingInRound = await questions
          .find({ roomId: { $in: roomIds }, roundType: 'normal', roundName: cleanRoundName })
          .toArray();
        qNumber = existingInRound.length + 1;
      } else {
        const existing = await questions
          .find({ roomId: { $in: roomIds }, roundType: 'normal' })
          .toArray();
        qNumber = existing.length + 1;
      }
    }
  }

  const id = crypto.randomUUID();
  const question: Question = {
    id,
    _id: id,
    roomId: canonicalRoomId,
    roundType: data.roundType,
    roundName: cleanRoundName,
    setName: cleanSetName,
    number: qNumber || 1,
    qtype: data.qtype,
    prompt: data.prompt.trim(),
    options: data.options ?? [],
    correctAnswer: data.correctAnswer.trim(),
    mediaUrl: data.mediaUrl?.trim() || null,
    points: data.points ?? 10,
    timerSeconds: data.timerSeconds || null,
    status: 'unused',
    answeredBy: null,
  };

  await questions.insertOne(question);

  const rooms = await getRoomsCollection();
  const roomUpdate: Record<string, unknown> = { $inc: { version: 1 } };
  if (cleanRoundName) {
    roomUpdate.$addToSet = { customRounds: cleanRoundName };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await rooms.updateOne({ id: canonicalRoomId }, roomUpdate as any);

  return question;
}

export async function deleteQuestion(questionId: string) {
  await assertAdmin();

  const questions = await getQuestionsCollection();
  const question = await questions.findOne({ id: questionId });
  if (!question) return;

  await questions.deleteOne({ id: questionId });

  const room = await resolveRoom(question.roomId);
  if (room) {
    const rooms = await getRoomsCollection();
    await rooms.updateOne({ id: room.id }, { $inc: { version: 1 } });
  }
}

export async function resetQuestionStatus(questionId: string) {
  await assertAdmin();

  const questions = await getQuestionsCollection();
  const question = await questions.findOne({ id: questionId });
  if (!question) return;

  await questions.updateOne(
    { id: questionId },
    { $set: { status: 'unused', answeredBy: null } }
  );

  const room = await resolveRoom(question.roomId);
  if (room) {
    const rooms = await getRoomsCollection();
    await rooms.updateOne({ id: room.id }, { $inc: { version: 1 } });
  }
}

export async function getRoomQuestions(roomId: string): Promise<Question[]> {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  const questions = await getQuestionsCollection();
  if (room) {
    return questions
      .find({ roomId: { $in: [room.id, room.code] } })
      .sort({ roundName: 1, roundType: 1, setName: 1, number: 1 })
      .toArray();
  }
  return questions
    .find({ roomId })
    .sort({ roundName: 1, roundType: 1, setName: 1, number: 1 })
    .toArray();
}

