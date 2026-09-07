'use server';

import {
  getRoomsCollection,
  getContestantsCollection,
  getQuestionsCollection,
  Room,
  Contestant,
  Question,
} from '@/lib/db';
import { assertAdmin, loginAdmin, logoutAdmin, checkIsAdmin } from '@/lib/session';

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
    currentRoundName: null,
    customRounds: [],
    currentQuestionId: null,
    activeContestantId: null,
    timerEndsAt: null,
    timerSeconds: 30,
    passCount: 0,
    lastResult: null,
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
      // Check device session locking
      if (existingGroup.claimToken) {
        // If client sends matching token, allow reconnect seamlessly
        if (clientClaimToken && clientClaimToken === existingGroup.claimToken) {
          await contestants.updateOne(
            { id: existingGroup.id },
            { $set: { lastActiveAt: new Date() } }
          );
          return {
            success: true,
            roomId: room.id,
            contestantId: existingGroup.id,
            groupName: existingGroup.name,
            joinOrder: existingGroup.joinOrder,
            claimToken: existingGroup.claimToken,
            reconnected: true,
          };
        }

        // Another device is already holding this team session!
        return {
          success: false,
          error: `Team "${existingGroup.name}" is already active on another device. Please log out from that device to switch.`,
        };
      }

      // If team exists but has no active claim token (e.g. host added or previously logged out), claim it
      const newClaimToken = crypto.randomUUID();
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

    if (existingGroups.length >= 8) {
      return { success: false, error: 'Room is full (8 groups maximum).' };
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
      .toArray();

    return {
      exists: true,
      roomId: room.id,
      code: room.code,
      name: room.name,
      status: room.status,
      groupCount: groups.length,
      maxGroups: 8,
      isFull: groups.length >= 8,
    };
  } catch {
    return { exists: false };
  }
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
  const canonicalId = room ? room.id : roomId;
  const cleanName = groupName.trim();
  if (!cleanName) throw new Error('Group name cannot be empty');

  const contestants = await getContestantsCollection();
  const roomIds = [canonicalId, room?.code].filter(Boolean) as string[];
  const existingGroups = await contestants
    .find({ roomId: { $in: roomIds }, kind: 'group' })
    .toArray();

  if (existingGroups.length >= 8) {
    throw new Error('Room is full. Maximum 8 groups allowed.');
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
}

export async function resetGame(roomId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;
  const roomIds = [canonicalId, room.code];

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        status: 'lobby',
        currentQuestionId: null,
        activeContestantId: null,
        timerEndsAt: null,
        passCount: 0,
        lastResult: null,
        roundType: 'normal',
      },
      $inc: { version: 1 },
    }
  );

  const contestants = await getContestantsCollection();
  await contestants.updateMany({ roomId: { $in: roomIds } }, { $set: { score: 0 } });

  const questions = await getQuestionsCollection();
  await questions.updateMany({ roomId: { $in: roomIds } }, { $set: { status: 'unused', answeredBy: null } });
}

// -------------------------------------------------------------
// GAME ENGINE ACTIONS
// -------------------------------------------------------------

export async function showQuestion(roomId: string, questionId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const questions = await getQuestionsCollection();
  await questions.updateOne({ id: questionId }, { $set: { status: 'active' } });

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        currentQuestionId: questionId,
        passCount: 0,
        lastResult: null,
        timerEndsAt: null,
      },
      $inc: { version: 1 },
    }
  );
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
}

export async function markCorrect(
  roomId: string,
  targetContestantId?: string
): Promise<{
  success: boolean;
  pointsAwarded?: number;
  contestantName?: string;
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

  const contestant = await contestants.findOne({ id: recipientId });
  if (!contestant) {
    return { success: false, error: 'Contestant not found' };
  }

  // Award points: auto add question.points
  const points = question.points ?? 10;
  await contestants.updateOne(
    { id: contestant.id },
    { $set: { score: contestant.score + points } }
  );

  // If this contestant is an individual in rapid fire, award points to parent group directly too
  if (contestant.kind === 'individual' && contestant.parentGroupId) {
    await contestants.updateOne(
      { id: contestant.parentGroupId },
      { $inc: { score: points } }
    );
  }

  // Mark question done
  await questions.updateOne(
    { id: question.id },
    { $set: { status: 'done', answeredBy: contestant.id } }
  );

  // Update room
  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        lastResult: 'correct',
        timerEndsAt: null,
      },
      $inc: { version: 1 },
    }
  );

  return {
    success: true,
    pointsAwarded: points,
    contestantName: contestant.name,
  };
}

export async function markWrong(roomId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room) return;
  const canonicalId = room.id;

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: { lastResult: 'wrong' },
      $inc: { version: 1 },
    }
  );
}

export async function passQuestion(roomId: string) {
  const room = await resolveRoom(roomId);
  if (!room || !room.currentQuestionId) return;
  const canonicalId = room.id;

  const contestants = await getContestantsCollection();
  const groups = await contestants
    .find({ roomId: { $in: [canonicalId, room.code] }, kind: 'group' })
    .sort({ joinOrder: 1 })
    .toArray();

  if (groups.length === 0) return;

  // If all groups have had their chance, close the question with no points
  if (room.passCount >= groups.length - 1) {
    const questions = await getQuestionsCollection();
    await questions.updateOne(
      { id: room.currentQuestionId },
      { $set: { status: 'done' } }
    );

    const rooms = await getRoomsCollection();
    await rooms.updateOne(
      { id: canonicalId },
      {
        $set: {
          timerEndsAt: null,
          lastResult: null,
        },
        $inc: { version: 1 },
      }
    );
    return { closed: true };
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
}

export async function closeQuestion(roomId: string) {
  await assertAdmin();
  const room = await resolveRoom(roomId);
  if (!room || !room.currentQuestionId) return;
  const canonicalId = room.id;

  const questions = await getQuestionsCollection();
  await questions.updateOne(
    { id: room.currentQuestionId },
    { $set: { status: 'done' } }
  );

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: canonicalId },
    {
      $set: {
        currentQuestionId: null,
        timerEndsAt: null,
        lastResult: null,
        passCount: 0,
      },
      $inc: { version: 1 },
    }
  );
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
  }
}

// -------------------------------------------------------------
// RAPID FIRE ACTIONS
// -------------------------------------------------------------

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

  // Check if an individual entry for this member already exists in room
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

  // Add individual's score to parent group
  await contestants.updateOne(
    { id: parentGroup.id },
    { $set: { score: parentGroup.score + individual.score } }
  );

  // Reset individual score so it cannot be credited multiple times
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

  // If number wasn't provided for rapid fire, auto-increment
  let qNumber = data.number ?? 1;
  if (data.roundType === 'rapid_fire' && !data.number) {
    const existing = await questions
      .find({ roomId: { $in: roomIds }, roundType: 'rapid_fire' })
      .toArray();
    qNumber = existing.length + 1;
  }

  const cleanRoundName = data.roundName?.trim() || null;

  const id = crypto.randomUUID();
  const question: Question = {
    id,
    _id: id,
    roomId: canonicalRoomId,
    roundType: data.roundType,
    roundName: cleanRoundName,
    number: qNumber,
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
      .sort({ roundName: 1, roundType: 1, number: 1 })
      .toArray();
  }
  return questions
    .find({ roomId })
    .sort({ roundName: 1, roundType: 1, number: 1 })
    .toArray();
}
