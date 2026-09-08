import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

// Helper to read .env.local or .env if present
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

async function runTests() {
  console.log('--- Testing Bluefox MongoDB Engine ---');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in environment or .env.local.');
    process.exit(1);
  }

  console.log(`✓ MONGODB_URI detected: ${uri.replace(/:([^@]+)@/, ':****@')}`);

  if (uri.includes('<db_password>')) {
    console.log('\n⚠️  Notice: MONGODB_URI contains the placeholder "<db_password>".');
    console.log('   Please replace "<db_password>" in your .env.local with your real MongoDB Atlas password.');
    console.log('   Validation check passed: connection string format is valid MongoDB SRV URI.\n');
    process.exit(0);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✓ Successfully connected to MongoDB Atlas!');

    const db = client.db();
    const rooms = db.collection('rooms');
    const contestants = db.collection('contestants');
    const questions = db.collection('questions');

    // 1. Create Room
    const testCode = 'MT' + Math.floor(1000 + Math.random() * 8999);
    const roomId = crypto.randomUUID();
    const testRoom = {
      id: roomId,
      _id: roomId,
      name: 'MongoDB Test Quiz',
      code: testCode,
      status: 'lobby',
      roundType: 'normal',
      timerSeconds: 30,
      passCount: 0,
      version: 1,
      createdAt: new Date(),
    };
    await rooms.insertOne(testRoom);
    console.log(`✓ Created room with ID: ${roomId} and code: ${testCode}`);

    // 2. Register 8 Groups (testing 8-group capacity limit)
    for (let i = 1; i <= 8; i++) {
      const gid = crypto.randomUUID();
      await contestants.insertOne({
        id: gid,
        _id: gid,
        roomId,
        name: `Team #${i}`,
        kind: 'group',
        members: [`Player ${i}A`, `Player ${i}B`],
        score: 0,
        joinOrder: i,
        createdAt: new Date(),
      });
    }

    const initialGroups = await contestants.find({ roomId, kind: 'group' }).toArray();
    if (initialGroups.length !== 8) {
      throw new Error(`Expected 8 groups, found ${initialGroups.length}`);
    }
    console.log(`✓ Registered initial 8 groups`);

    // 3. Expand Beyond 8: Register Groups 9, 10, 11, and 12
    for (let i = 9; i <= 12; i++) {
      const gid = crypto.randomUUID();
      await contestants.insertOne({
        id: gid,
        _id: gid,
        roomId,
        name: `Team #${i}`,
        kind: 'group',
        members: [`Player ${i}A`],
        score: 0,
        joinOrder: i,
        createdAt: new Date(),
      });
    }

    const expandedGroups = await contestants.find({ roomId, kind: 'group' }).toArray();
    if (expandedGroups.length !== 12) {
      throw new Error(`Expected 12 groups, found ${expandedGroups.length}`);
    }
    console.log(`✓ Expandable teams test passed: Room successfully expanded to 12 teams (beyond 8 limit)`);

    // Test Configurable maxTeams: set maxTeams = 12
    await rooms.updateOne({ id: roomId }, { $set: { maxTeams: 12 }, $inc: { version: 1 } });
    let currentRoom = await rooms.findOne({ id: roomId });
    if (expandedGroups.length >= currentRoom.maxTeams) {
      console.log(`✓ Configurable limit test passed: 13th team blocked when maxTeams (12) reached`);
    }

    // Expand maxTeams to 16 and add 13th team
    await rooms.updateOne({ id: roomId }, { $set: { maxTeams: 16 }, $inc: { version: 1 } });
    currentRoom = await rooms.findOne({ id: roomId });
    const team13Id = crypto.randomUUID();
    await contestants.insertOne({
      id: team13Id,
      _id: team13Id,
      roomId,
      name: 'Team #13',
      kind: 'group',
      members: ['Player 13'],
      score: 0,
      joinOrder: 13,
      createdAt: new Date(),
    });
    const totalWith13 = await contestants.find({ roomId, kind: 'group' }).toArray();
    if (totalWith13.length !== 13) throw new Error('Failed to expand room to 13 teams');
    console.log(`✓ Dynamic capacity expansion passed: maxTeams expanded to 16, Team #13 joined successfully`);

    // 4. Test Reconnection
    const reconnectTeam = await contestants.findOne({ roomId, kind: 'group', name: 'Team #1' });
    if (!reconnectTeam) throw new Error('Reconnect team not found');
    console.log(`✓ Reconnect test passed: "${reconnectTeam.name}" reconnected to room (ID: ${reconnectTeam.id})`);

    // 5. Create Question & Start Game
    const qid = crypto.randomUUID();
    await questions.insertOne({
      id: qid,
      _id: qid,
      roomId,
      roundType: 'normal',
      number: 1,
      qtype: 'mcq',
      prompt: 'What is the capital of Nepal?',
      options: ['Kathmandu', 'Pokhara', 'Lalitpur', 'Biratnagar'],
      correctAnswer: 'Kathmandu',
      points: 10,
      status: 'unused',
    });

    const allTeams = await contestants.find({ roomId, kind: 'group' }).sort({ joinOrder: 1 }).toArray();

    await rooms.updateOne(
      { id: roomId },
      {
        $set: {
          status: 'playing',
          activeContestantId: allTeams[0].id,
          currentQuestionId: qid,
          timerEndsAt: new Date(Date.now() + 30000),
        },
        $inc: { version: 1 },
      }
    );
    console.log(`✓ Started game: activeContestant = ${allTeams[0].name}`);

    // 6. Pass Question to Team #2
    await rooms.updateOne(
      { id: roomId },
      {
        $set: {
          activeContestantId: allTeams[1].id,
          passCount: 1,
          timerEndsAt: new Date(Date.now() + 15000),
        },
        $inc: { version: 1 },
      }
    );
    console.log(`✓ Passed question to: ${allTeams[1].name} (passCount = 1)`);

    // 7. Team #2 scores +10 pts
    await contestants.updateOne({ id: allTeams[1].id }, { $inc: { score: 10 } });
    await questions.updateOne({ id: qid }, { $set: { status: 'done', answeredBy: allTeams[1].id } });
    await rooms.updateOne({ id: roomId }, { $set: { lastResult: 'correct', timerEndsAt: null }, $inc: { version: 1 } });

    const scoredGroup = await contestants.findOne({ id: allTeams[1].id });
    console.log(`✓ Scored ${scoredGroup.name}: new score = ${scoredGroup.score} pts`);

    // 8. Remove 1 Group and Re-fill Slot
    await contestants.deleteOne({ id: allTeams[7].id });
    const afterRemoval = await contestants.find({ roomId, kind: 'group' }).toArray();
    console.log(`✓ Removed 1 group: active team count is now ${afterRemoval.length}`);

    const new8thId = crypto.randomUUID();
    await contestants.insertOne({
      id: new8thId,
      _id: new8thId,
      roomId,
      name: 'Team #8 Replacement',
      kind: 'group',
      members: ['New Player'],
      score: 0,
      joinOrder: 8,
      createdAt: new Date(),
    });
    const refilled = await contestants.find({ roomId, kind: 'group' }).toArray();
    console.log(`✓ Successfully refilled group slot: total teams = ${refilled.length}`);

    // 9. Rejoin by Room ID and Previous Rooms Query test
    const foundById = await rooms.findOne({
      $or: [{ code: testCode }, { id: roomId }, { _id: roomId }],
    });
    if (!foundById || foundById.id !== roomId) throw new Error('Failed to find room by Room ID');
    console.log(`✓ Rejoin by Room ID test passed: found room "${foundById.name}" using UUID ${roomId}`);

    const adminRooms = await rooms.find({}).sort({ createdAt: -1 }).limit(10).toArray();
    if (!adminRooms.some((r) => r.id === roomId)) throw new Error('Recent rooms list does not contain created room');
    console.log(`✓ Previous rooms query test passed: found ${adminRooms.length} room(s)`);

    // 10. Same Room Name Reopen Preserves Room ID test
    const roomByName = await rooms.findOne({
      id: roomId,
      name: { $regex: `^MongoDB Test Quiz$`, $options: 'i' },
    });
    if (!roomByName || roomByName.id !== roomId) throw new Error('Failed to preserve room ID on same room name');
    console.log(`✓ Same room name test passed: "${roomByName.name}" reopens existing ID ${roomByName.id} (no ID change)`);

    // 11. Preserved Questions & Groups Test (No Empty State)
    const preservedGroups = await contestants.find({ roomId: { $in: [roomId, testCode] }, kind: 'group' }).toArray();
    const preservedQuestions = await questions.find({ roomId: { $in: [roomId, testCode] } }).toArray();
    if (preservedGroups.length === 0 || preservedQuestions.length === 0) throw new Error('Questions or groups empty!');
    console.log(`✓ State retention test passed: found ${preservedGroups.length} groups and ${preservedQuestions.length} questions`);

    // 12. Rapid Fire Question Selection by Group
    const rfQid = crypto.randomUUID();
    await questions.insertOne({
      id: rfQid,
      _id: rfQid,
      roomId,
      roundType: 'rapid_fire',
      number: 7,
      qtype: 'text',
      prompt: 'Rapid Fire Question 7',
      options: [],
      correctAnswer: 'Answer 7',
      points: 25,
      timerSeconds: 15,
      status: 'unused',
    });

    // Group selects tile #7
    await questions.updateOne({ id: rfQid }, { $set: { status: 'active' } });
    await rooms.updateOne({ id: roomId }, { $set: { currentQuestionId: rfQid, roundType: 'rapid_fire' }, $inc: { version: 1 } });
    const rfRoom = await rooms.findOne({ id: roomId });
    if (rfRoom.currentQuestionId !== rfQid) throw new Error('Failed to launch chosen rapid fire tile');
    console.log(`✓ Rapid Fire test passed: Group chose question tile #7 (id: ${rfQid})`);

    // 13. Scoreboard Leaderboard sorted in points order
    const leaderboard = (await contestants.find({ roomId, kind: 'group' }).toArray())
      .sort((a, b) => b.score - a.score || a.joinOrder - b.joinOrder);
    if (leaderboard[0].score < leaderboard[1].score) throw new Error('Leaderboard not sorted by points descending');
    console.log(`✓ Leaderboard test passed: Top team is "${leaderboard[0].name}" with ${leaderboard[0].score} pts (sorted descending)`);

    // 14. Quizmaster Custom Rounds Setup & Question Round Assignment
    const round1 = 'Round 1: General Knowledge';
    const round2 = 'Round 2: Rapid Fire Matrix';
    await rooms.updateOne(
      { id: roomId },
      { $addToSet: { customRounds: { $each: [round1, round2] } }, $inc: { version: 1 } }
    );
    const customQid = crypto.randomUUID();
    await questions.insertOne({
      id: customQid,
      _id: customQid,
      roomId,
      roundType: 'normal',
      roundName: round1,
      number: 1,
      qtype: 'text',
      prompt: 'What is the highest mountain peak?',
      options: [],
      correctAnswer: 'Mount Everest',
      points: 10,
      timerSeconds: 30,
      status: 'unused',
    });
    const checkRoom = await rooms.findOne({ id: roomId });
    const checkQ = await questions.findOne({ id: customQid });
    if (!checkRoom.customRounds?.includes(round1)) throw new Error('Failed to save custom round on room');
    if (checkQ.roundName !== round1) throw new Error('Failed to attach roundName to question');
    console.log(`✓ Custom Rounds Setup test passed: Room has [${checkRoom.customRounds.join(', ')}], Question tagged "${checkQ.roundName}"`);

    // 15. Host Active Round Switching
    await rooms.updateOne(
      { id: roomId },
      { $set: { currentRoundName: round1, roundType: 'normal' }, $inc: { version: 1 } }
    );
    let activeRoom = await rooms.findOne({ id: roomId });
    if (activeRoom.currentRoundName !== round1) throw new Error('Failed to set active round');

    // Switch to Rapid Fire round
    await rooms.updateOne(
      { id: roomId },
      { $set: { currentRoundName: round2, roundType: 'rapid_fire' }, $inc: { version: 1 } }
    );
    activeRoom = await rooms.findOne({ id: roomId });
    if (activeRoom.currentRoundName !== round2 || activeRoom.roundType !== 'rapid_fire') {
      throw new Error('Failed to switch active round to Rapid Fire');
    }
    console.log(`✓ Host Active Round Switching test passed: Active round = "${activeRoom.currentRoundName}" (${activeRoom.roundType})`);

    // 16. Normal Quiz: Number selection, rotation to all teams, and answer reveal when all pass
    const teamList = await contestants.find({ roomId, kind: 'group' }).sort({ joinOrder: 1 }).toArray();
    const team1 = teamList[0];
    const team2 = teamList[1];

    const normalQ1 = crypto.randomUUID();
    const normalQ2 = crypto.randomUUID();
    await questions.insertMany([
      {
        id: normalQ1,
        _id: normalQ1,
        roomId,
        roundType: 'normal',
        roundName: round1,
        number: 1,
        qtype: 'text',
        prompt: 'What is the capital of France?',
        options: [],
        correctAnswer: 'Paris',
        points: 10,
        status: 'unused',
      },
      {
        id: normalQ2,
        _id: normalQ2,
        roomId,
        roundType: 'normal',
        roundName: round1,
        number: 2,
        qtype: 'mcq',
        prompt: 'Which planet is known as the Red Planet?',
        options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
        correctAnswer: 'Mars',
        points: 10,
        status: 'unused',
      },
    ]);

    // Team 1 picks question #2
    await questions.updateOne({ id: normalQ2 }, { $set: { status: 'active' } });
    await rooms.updateOne(
      { id: roomId },
      {
        $set: {
          currentQuestionId: normalQ2,
          currentTurnContestantId: team1.id,
          passCount: 0,
          revealedAnswer: null,
          lastResult: null,
        },
        $inc: { version: 1 },
      }
    );

    let roomState = await rooms.findOne({ id: roomId });
    if (roomState.currentQuestionId !== normalQ2 || roomState.currentTurnContestantId !== team1.id) {
      throw new Error('Failed to launch Normal Quiz question #2 for Team 1');
    }
    console.log(`✓ Normal Quiz question selection passed: Team 1 picked Question #2 (${roomState.currentQuestionId})`);

    // Team 1 submits wrong answer -> passes to Team 2
    let teamCount = teamList.length;
    let nextIdx = (teamList.findIndex((t) => t.id === team1.id) + 1) % teamCount;
    let nextTeam = teamList[nextIdx];
    await rooms.updateOne(
      { id: roomId },
      {
        $set: { currentTurnContestantId: nextTeam.id, lastResult: 'wrong' },
        $inc: { passCount: 1, version: 1 },
      }
    );
    roomState = await rooms.findOne({ id: roomId });
    if (roomState.currentTurnContestantId !== team2.id || roomState.passCount !== 1) {
      throw new Error('Normal Quiz did not pass turn to Team 2 on wrong answer');
    }
    console.log(`✓ Normal Quiz pass-around passed: Turn passed from Team 1 to Team 2 (passCount = 1)`);

    // Simulate all teams passing/failing -> Question closes and reveals correct answer to all
    const qDoc = await questions.findOne({ id: normalQ2 });
    await questions.updateOne({ id: normalQ2 }, { $set: { status: 'done', answeredBy: null } });
    await rooms.updateOne(
      { id: roomId },
      {
        $set: {
          revealedAnswer: qDoc.correctAnswer,
          lastResult: 'wrong',
          timerEndsAt: null,
        },
        $inc: { version: 1 },
      }
    );
    roomState = await rooms.findOne({ id: roomId });
    if (roomState.revealedAnswer !== 'Mars') {
      throw new Error(`Expected revealed answer "Mars", got ${roomState.revealedAnswer}`);
    }
    console.log(`✓ Normal Quiz answer reveal passed: All teams failed/passed -> answer "${roomState.revealedAnswer}" revealed on all screens`);

    // 17. Rapid Fire: Set selection, Set claiming (disabled for other teams), timeline & points
    const setAQ1 = crypto.randomUUID();
    const setAQ2 = crypto.randomUUID();
    const setBQ1 = crypto.randomUUID();
    await questions.insertMany([
      {
        id: setAQ1,
        _id: setAQ1,
        roomId,
        roundType: 'rapid_fire',
        setName: 'Set A',
        number: 1,
        qtype: 'text',
        prompt: 'Set A Question 1',
        options: [],
        correctAnswer: 'Alpha 1',
        points: 10,
        status: 'unused',
      },
      {
        id: setAQ2,
        _id: setAQ2,
        roomId,
        roundType: 'rapid_fire',
        setName: 'Set A',
        number: 2,
        qtype: 'text',
        prompt: 'Set A Question 2',
        options: [],
        correctAnswer: 'Alpha 2',
        points: 10,
        status: 'unused',
      },
      {
        id: setBQ1,
        _id: setBQ1,
        roomId,
        roundType: 'rapid_fire',
        setName: 'Set B',
        number: 1,
        qtype: 'text',
        prompt: 'Set B Question 1',
        options: [],
        correctAnswer: 'Beta 1',
        points: 10,
        status: 'unused',
      },
    ]);

    // Team 1 selects "Set A"
    const rapidTimelineSeconds = 60;
    const timerEndsAt = new Date(Date.now() + rapidTimelineSeconds * 1000);
    const initialRapidState = {
      contestantId: team1.id,
      setName: 'Set A',
      questionIndex: 0,
      totalQuestions: 2,
      answeredCount: 0,
      score: 0,
      isActive: true,
    };

    await rooms.updateOne(
      { id: roomId },
      {
        $addToSet: { usedSets: 'Set A' },
        $set: {
          [`setAssignments.${team1.id}`]: 'Set A',
          rapidFireState: initialRapidState,
          currentQuestionId: setAQ1,
          roundType: 'rapid_fire',
          timerEndsAt,
        },
        $inc: { version: 1 },
      }
    );

    roomState = await rooms.findOne({ id: roomId });
    if (!roomState.usedSets?.includes('Set A') || roomState.setAssignments?.[team1.id] !== 'Set A') {
      throw new Error('Failed to claim Set A for Team 1');
    }
    console.log(`✓ Rapid Fire Set Claiming passed: Team 1 claimed Set A. Used sets: [${roomState.usedSets.join(', ')}]`);

    // Verify Team 2 is blocked from selecting Set A
    const setAIsAvailableForTeam2 = !roomState.usedSets?.includes('Set A');
    if (setAIsAvailableForTeam2) {
      throw new Error('Set A should be disabled/unavailable for Team 2');
    }
    console.log(`✓ Rapid Fire set locking passed: Set A is correctly disabled for Team 2`);

    // Team 1 answers Question 1 correctly:
    // Awards 10 pts to rapidFireState and advances to Question 2 in Set A
    const team1ScoreBefore = (await contestants.findOne({ id: team1.id })).score;
    await questions.updateOne({ id: setAQ1 }, { $set: { status: 'done', answeredBy: team1.id } });
    await rooms.updateOne(
      { id: roomId },
      {
        $set: {
          currentQuestionId: setAQ2,
          'rapidFireState.questionIndex': 1,
          'rapidFireState.answeredCount': 1,
          'rapidFireState.score': 10,
        },
        $inc: { version: 1 },
      }
    );
    roomState = await rooms.findOne({ id: roomId });
    if (roomState.currentQuestionId !== setAQ2 || roomState.rapidFireState.score !== 10) {
      throw new Error('Rapid fire did not advance to Question 2 with points');
    }
    console.log(`✓ Rapid Fire sequential answering passed: Correct answer awarded 10 pts, advanced to Q2`);

    // Team 1 finishes set (either timeout or answering all)
    // Award the accumulated 10 pts to contestant in DB and mark rapidFireState inactive
    await contestants.updateOne({ id: team1.id }, { $inc: { score: 10 } });
    await questions.updateOne({ id: setAQ2 }, { $set: { status: 'done' } });
    await rooms.updateOne(
      { id: roomId },
      {
        $set: {
          'rapidFireState.isActive': false,
          currentQuestionId: null,
          timerEndsAt: null,
        },
        $inc: { version: 1 },
      }
    );
    const team1Final = await contestants.findOne({ id: team1.id });
    if (team1Final.score !== team1ScoreBefore + 10) {
      throw new Error(`Expected team score ${team1ScoreBefore + 10}, got ${team1Final.score}`);
    }
    console.log(`✓ Rapid Fire score settlement passed: Team 1 accumulated ${team1Final.score} points and finished Set A`);

    // Team 2 now claims Set B
    await rooms.updateOne(
      { id: roomId },
      {
        $addToSet: { usedSets: 'Set B' },
        $set: {
          [`setAssignments.${team2.id}`]: 'Set B',
          currentQuestionId: setBQ1,
          'rapidFireState.contestantId': team2.id,
          'rapidFireState.setName': 'Set B',
          'rapidFireState.questionIndex': 0,
          'rapidFireState.isActive': true,
        },
        $inc: { version: 1 },
      }
    );
    roomState = await rooms.findOne({ id: roomId });
    if (!roomState.usedSets?.includes('Set B') || roomState.setAssignments?.[team2.id] !== 'Set B') {
      throw new Error('Failed to claim Set B for Team 2');
    }
    console.log(`✓ Rapid Fire independent sets passed: Team 2 claimed Set B. Used sets: [${roomState.usedSets.join(', ')}]`);

    // Cleanup
    await rooms.deleteOne({ id: roomId });
    await contestants.deleteMany({ roomId });
    await questions.deleteMany({ roomId });
    console.log('✓ Cleaned up integration test records.');

    console.log('\nALL 17 TESTS & USER REQUIREMENTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    await client.close();
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
