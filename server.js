require('dotenv').config();
const express = require('express');
const path = require('path');
const sendBooking = require('./api/send-booking');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Mount the API route exactly as Vercel does
app.post('/api/send-booking', sendBooking);
app.options('/api/send-booking', sendBooking);

// Start server
app.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 LOCAL DEVELOPMENT SERVER IS RUNNING!`);
    console.log(`=================================================`);
    console.log(`👉 Open your browser to: http://localhost:${PORT}`);
    console.log(`👉 API Endpoint is live at: http://localhost:${PORT}/api/send-booking`);
    console.log(`\nYou can now test your booking forms properly!`);
    console.log(`Press Ctrl + C to stop the server.\n`);
});
