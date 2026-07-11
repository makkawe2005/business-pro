const express = require('express');
const path = require('path');
const app = express();
const port = process.env.STATIC_PORT || 8000;

app.use(express.static(path.join(__dirname, '..')));

app.listen(port, () => console.log(`Static server running at http://127.0.0.1:${port}`));
