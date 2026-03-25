const express = require('express');
const path = require('path');

const app = express();
const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

const htmlRoutes = {
  '/': 'index.html',
  '/index': 'index.html',
  '/register': 'register.html',
  '/dashboard': 'dashboard.html',
  '/expenses': 'expenses.html',
  '/profile': 'profile.html',
  '/upload-ticket': 'upload-ticket.html',
  '/advisor': 'advisor.html',
};

app.get('/js/runtime-config.js', (_req, res) => {
  const apiBaseUrl = (process.env.API_BASE_URL || '').trim();
  res.type('application/javascript');
  res.send(
    `window.__GASTOSAPP_CONFIG__ = {\n  apiBaseUrl: ${JSON.stringify(apiBaseUrl)}\n};\n`,
  );
});

app.use(express.static(rootDir, { extensions: ['html'] }));

Object.entries(htmlRoutes).forEach(([route, file]) => {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(rootDir, file));
  });
});

app.listen(port, () => {
  console.log(`Frontend running on http://localhost:${port}`);
});
