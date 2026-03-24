const fs = require('fs');
const file = 'backend/src/controllers/adminController.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /let tournaments = \[\];\s*if\s*\(tournamentIds\.length > 0\)\s*\{\s*tournaments = await db\.collection\('tournaments'\)\.find\(\{ _id: \{ \$in: tournamentIds \} \}\)\.project\(\{ name: 1, title: 1, type: 1, start_date: 1, date: 1, entry_fee: 1, status: 1 \}\)\.toArray\(\);\s*\}/s;

const replacement = `let tournaments = [];
    if(tournamentIds.length > 0) {
      const tData = await db.collection('tournaments').find({ _id: { $in: tournamentIds } }).project({ name: 1, title: 1, type: 1, start_date: 1, date: 1, entry_fee: 1, status: 1 }).toArray();
      tournaments = tData.map(t => {
        const pRecord = ptournaments.find(pt => String(pt.tournament_id) === String(t._id));
        return {
          ...t,
          position: pRecord ? (pRecord.rank || pRecord.position || pRecord.status || 'N/A') : 'N/A'
        };
      });
    }`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content);
  console.log('Successfully updated adminController!');
} else {
  console.log('Regex NOT matched.');
}
