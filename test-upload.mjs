import fs from 'fs';

const file = new Blob(['hello'], { type: 'text/plain' });
const formData = new FormData();
formData.append('file', file, 'hello.txt');
formData.append('folder', 'Bonusses');

const res = await fetch('https://api.growwithai.id/api/admin/storage/upload', {
  method: 'POST',
  body: formData,
  headers: {
    // Need authorization though!
  }
});

console.log(await res.text());
