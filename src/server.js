import { createApp } from './app.js';

const port = Number(process.env.PORT || 4137);
const app = createApp();

app.listen(port, () => {
  console.log(`StreamVault is running at http://localhost:${port}`);
});
