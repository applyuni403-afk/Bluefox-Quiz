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

// -------------------------------------------------------------
// ROOM & LOBBY ACTIONS
// -------------------------------------------------------------

export async function createRoom(name: string): Promise<Room> {
  await assertAdmin();

  const rooms = await getRoomsCollection();
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
    name: name.trim() || 'Bluefox Quiz Room',
    code,
    status: 'lobby',
    roundType: 'normal',
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
  code: string,
  groupName: string,
  rawMembers: string[] = []
): Promise<{
  success: boolean;
  roomId?: string;
  contestantId?: string;
  groupName?: string;
  joinOrder?: number;
  error?: string;
  reconnected?: boolean;
}> {
  try {
    const cleanCode = code.trim().toUpperCase();
    const rooms = await getRoomsCollection();
    const room = await rooms.findOne({ code: cleanCode });

    if (!room) {
      return { success: false, error: 'Room not found. Please check the 6-character code.' };
    }

    const cleanGroupName = groupName.trim();
    const contestants = await getContestantsCollection();

    // Check if this group already exists in the room (Reconnect support!)
    const existingGroup = await contestants.findOne({
      roomId: room.id,
      kind: 'group',
      name: cleanGroupName,
    });

    if (existingGroup) {
      return {
        success: true,
        roomId: room.id,
        contestantId: existingGroup.id,
        groupName: existingGroup.name,
        joinOrder: existingGroup.joinOrder,
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
      .find({ roomId: room.id, kind: 'group' })
      .toArray();

    if (existingGroups.length >= 8) {
      return { success: false, error: 'Room is full (8 groups maximum).' };
    }

    const members = rawMembers
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    const id = crypto.randomUUID();
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
      createdAt: new Date(),
    };

    await contestants.insertOne(newContestant);

    // Bump room version for polling detection
    await rooms.updateOne({ id: room.id }, { $inc: { version: 1 } });

    return {
      success: true,
      roomId: room.id,
      contestantId: newContestant.id,
      groupName: newContestant.name,
      joinOrder: newContestant.joinOrder,
    };
  } catch (err) {
    console.error('joinRoom action error:', err);
    return { success: false, error: (err as Error).message || 'Failed to join room' };
  }
}

export async function checkRoomCapacity(code: string) {
  const cleanCode = code.trim().toUpperCase();
  if (cleanCode.length !== 6) return null;

  try {
    const rooms = await getRoomsCollection();
    const room = await rooms.findOne({ code: cleanCode });

    if (!room) return { exists: false };

    const contestants = await getContestantsCollection();
    const groups = await contestants
      .find({ roomId: room.id, kind: 'group' })
      .toArray();

    return {
      exists: true,
      roomId: room.id,
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

export async function adminAddGroup(
  roomId: string,
  groupName: string,
  rawMembers: string[] = []
): Promise<Contestant> {
  await assertAdmin();

  const cleanName = groupName.trim();
  if (!cleanName) throw new Error('Group name cannot be empty');

  const contestants = await getContestantsCollection();
  const existingGroups = await contestants
    .find({ roomId, kind: 'group' })
    .toArray();

  if (existingGroups.length >= 8) {
    throw new Error('Room is full. Maximum 8 groups allowed.');
  }

  const members = rawMembers.map((m) => m.trim()).filter((m) => m.length > 0);
  const id = crypto.randomUUID();
  const newGroup: Contestant = {
    id,
    _id: id,
    roomId,
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
  await rooms.updateOne({ id: roomId }, { $inc: { version: 1 } });

  return newGroup;
}

export async function deleteRoom(roomId: string): Promise<{ success: boolean }> {
  await assertAdmin();

  const rooms = await getRoomsCollection();
  const contestants = await getContestantsCollection();
  const questions = await getQuestionsCollection();

  await rooms.deleteOne({ id: roomId });
  await contestants.deleteMany({ roomId });
  await questions.deleteMany({ roomId });

  return { success: true };
}

export async function adminRemoveGroup(roomId: string, contestantId: string) {
  await assertAdmin();

  const contestants = await getContestantsCollection();
  await contestants.deleteOne({ id: contestantId, roomId });
  await contestants.deleteMany({ roomId, parentGroupId: contestantId });

  // Re-index remaining groups joinOrder (1..N)
  const remainingGroups = await contestants
    .find({ roomId, kind: 'group' })
    .sort({ joinOrder: 1 })
    .toArray();

  for (let i = 0; i < remainingGroups.length; i++) {
    await contestants.updateOne(
      { id: remainingGroups[i].id },
      { $set: { joinOrder: i + 1 } }
    );
  }

  const rooms = await getRoomsCollection();
  const room = await rooms.findOne({ id: roomId });
  if (room && room.activeContestantId === contestantId) {
    await rooms.updateOne(
      { id: roomId },
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
    await rooms.updateOne({ id: roomId }, { $inc: { version: 1 } });
  }
}

export async function setRound(roomId: string, roundType: 'normal' | 'rapid_fire') {
  await assertAdmin();
  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: roomId },
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

export async function startGame(roomId: string) {
  await assertAdmin();
  const contestants = await getContestantsCollection();
  const firstGroup = await contestants.findOne(
    { roomId, kind: 'group' },
    { sort: { joinOrder: 1 } }
  );

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: roomId },
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
  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: roomId },
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
  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: roomId },
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
  await contestants.updateMany({ roomId }, { $set: { score: 0 } });

  const questions = await getQuestionsCollection();
  await questions.updateMany({ roomId }, { $set: { status: 'unused', answeredBy: null } });
}

// -------------------------------------------------------------
// GAME ENGINE ACTIONS
// -------------------------------------------------------------

export async function showQuestion(roomId: string, questionId: string) {
  await assertAdmin();

  const questions = await getQuestionsCollection();
  await questions.updateOne({ id: questionId }, { $set: { status: 'active' } });

  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: roomId },
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

  const rooms = await getRoomsCollection();
  const room = await rooms.findOne({ id: roomId });
  if (!room) return;

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

  await rooms.updateOne(
    { id: roomId },
    {
      $set: { timerEndsAt },
      $inc: { version: 1 },
    }
  );
}

export async function stopTimer(roomId: string) {
  await assertAdmin();
  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: roomId },
    {
      $set: { timerEndsAt: null },
      $inc: { version: 1 },
    }
  );
}

export async function setRoomTimerDefault(roomId: string, seconds: number) {
  await assertAdmin();
  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: roomId },
    {
      $set: { timerSeconds: seconds },
      $inc: { version: 1 },
    }
  );
}

export async function markCorrect(roomId: string) {
  await assertAdmin();

  const rooms = await getRoomsCollection();
  const room = await rooms.findOne({ id: roomId });
  if (!room || !room.currentQuestionId || !room.activeContestantId) {
    return;
  }

  const questions = await getQuestionsCollection();
  const question = await questions.findOne({ id: room.currentQuestionId });
  if (!question) return;

  const contestants = await getContestantsCollection();
  const contestant = await contestants.findOne({ id: room.activeContestantId });
  if (!contestant) return;

  // Award points
  const points = question.points ?? 10;
  await contestants.updateOne(
    { id: contestant.id },
    { $set: { score: contestant.score + points } }
  );

  // Mark question done
  await questions.updateOne(
    { id: question.id },
    { $set: { status: 'done', answeredBy: contestant.id } }
  );

  // Update room
  await rooms.updateOne(
    { id: roomId },
    {
      $set: {
        lastResult: 'correct',
        timerEndsAt: null,
      },
      $inc: { version: 1 },
    }
  );
}

export async function markWrong(roomId: string) {
  await assertAdmin();
  const rooms = await getRoomsCollection();
  await rooms.updateOne(
    { id: roomId },
    {
      $set: { lastResult: 'wrong' },
      $inc: { version: 1 },
    }
  );
}

export async function passQuestion(roomId: string) {
  const rooms = await getRoomsCollection();
  const room = await rooms.findOne({ id: roomId });
  if (!room || !room.currentQuestionId) return;

  const contestants = await getContestantsCollection();
  const groups = await contestants
    .find({ roomId, kind: 'group' })
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

    await rooms.updateOne(
      { id: roomId },
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

  await rooms.updateOne(
    { id: roomId },
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

  const rooms = await getRoomsCollection();
  const room = await rooms.findOne({ id: roomId });
  if (!room) return;

  const contestants = await getContestantsCollection();
  const groups = await contestants
    .find({ roomId, kind: 'group' })
    .sort({ joinOrder: 1 })
    .toArray();

  if (groups.length === 0) return;

  const currentIndex = groups.findIndex((g) => g.id === room.activeContestantId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % groups.length;
  const nextGroup = groups[nextIndex];

  await rooms.updateOne(
    { id: roomId },
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

  const rooms = await getRoomsCollection();
  const room = await rooms.findOne({ id: roomId });
  if (!room || !room.currentQuestionId) return;

  const questions = await getQuestionsCollection();
  await questions.updateOne(
    { id: room.currentQuestionId },
    { $set: { status: 'done' } }
  );

  await rooms.updateOne(
    { id: roomId },
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

  const rooms = await getRoomsCollection();
  await rooms.updateOne({ id: contestant.roomId }, { $inc: { version: 1 } });
}

// -------------------------------------------------------------
// RAPID FIRE ACTIONS
// -------------------------------------------------------------

export async function startRapidFireForIndividual(
  roomId: string,
  parentGroupId: string,
  memberName: string
): Promise<Contestant> {
  await assertAdmin();

  const contestants = await getContestantsCollection();

  // Check if an individual entry for this member already exists in room
  let individual = await contestants.findOne({
    roomId,
    kind: 'individual',
    parentGroupId,
    name: memberName.trim(),
  });

  if (!individual) {
    const id = crypto.randomUUID();
    const created: Contestant = {
      id,
      _id: id,
      roomId,
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
    { id: roomId },
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
  const rooms = await getRoomsCollection();
  const room = await rooms.findOne({ id: roomId });
  if (!room) return;

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

  await rooms.updateOne(
    { id: roomId },
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
  await rooms.updateOne({ id: roomId }, { $inc: { version: 1 } });
}

// -------------------------------------------------------------
// QUESTION EDITOR ACTIONS
// -------------------------------------------------------------

export interface CreateQuestionInput {
  roomId: string;
  roundType: 'normal' | 'rapid_fire';
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

  const questions = await getQuestionsCollection();

  // If number wasn't provided for rapid fire, auto-increment
  let qNumber = data.number ?? 1;
  if (data.roundType === 'rapid_fire' && !data.number) {
    const existing = await questions
      .find({ roomId: data.roomId, roundType: 'rapid_fire' })
      .toArray();
    qNumber = existing.length + 1;
  }

  const id = crypto.randomUUID();
  const question: Question = {
    id,
    _id: id,
    roomId: data.roomId,
    roundType: data.roundType,
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
  await rooms.updateOne({ id: data.roomId }, { $inc: { version: 1 } });

  return question;
}

export async function deleteQuestion(questionId: string) {
  await assertAdmin();

  const questions = await getQuestionsCollection();
  const question = await questions.findOne({ id: questionId });
  if (!question) return;

  await questions.deleteOne({ id: questionId });

  const rooms = await getRoomsCollection();
  await rooms.updateOne({ id: question.roomId }, { $inc: { version: 1 } });
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

  const rooms = await getRoomsCollection();
  await rooms.updateOne({ id: question.roomId }, { $inc: { version: 1 } });
}

export async function getRoomQuestions(roomId: string): Promise<Question[]> {
  await assertAdmin();
  const questions = await getQuestionsCollection();
  return questions
    .find({ roomId })
    .sort({ roundType: 1, number: 1 })
    .toArray();
}
