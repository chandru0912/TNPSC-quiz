const fs = require('fs');
const c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const old = `      const res = await apiFetch('/api/questions/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questions: approvedQuestions }),
      })

      const data = await res.json()
      if (res.ok) {
        uploadedSuccess = true
        countUploaded = data.inserted || approvedQuestions.length
      } else {`;
const neu = `      const res = await apiFetch('/api/questions/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questions: approvedQuestions }),
      })

      const data = await res.json()
      if (res.ok) {
        uploadedSuccess = true
        countUploaded = data.inserted || approvedQuestions.length
        try {
          await apiFetch('/api/questions/publish', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({}),
          })
        } catch (e) {
          // ignore
        }
      } else {`;
if (c.includes(old)) {
  const nc = c.replace(old, neu);
  fs.writeFileSync('src/pages/Admin.tsx', nc);
  console.log('ok');
} else {
  console.log('no');
}
