const { Firestore, FieldValue } = require('@google-cloud/firestore');
const express = require('express');
const xlsx = require('xlsx');
const path = require('path');
const app = express();

const firestore = new Firestore();
app.use(express.json());

// Serve static HTML form
app.use(express.static(path.join(__dirname, 'public')));

// 1. Endpoint to Save Data
app.post('/submit', async (req, res) => {
  const { textInput } = req.body;

  if (!textInput || typeof textInput !== 'string') {
    return res.status(400).send('Input is required.');
  }
  if (textInput.length > 20) {
    return res.status(400).send('Input must be 20 characters or less.');
  }

  try {
    await firestore.collection('user_inputs').add({
      textInput: textInput,
      createdAt: FieldValue.serverTimestamp()
    });
    res.status(200).send('Saved.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Database error.');
  }
});

// 2. Secret Endpoint to Download Excel File (e.g., your-url.run.app/export-data)
app.get('/export-data', async (req, res) => {
  try {
    // Fetch all records sorted by date
    const snapshot = await firestore.collection('user_inputs')
                                    .orderBy('createdAt', 'desc')
                                    .get();
    
    const rawData = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Format the Firestore timestamp into a readable date string
      const dateString = data.createdAt ? data.createdAt.toDate().toISOString() : 'N/A';
      
      rawData.push({
        'Text Input': data.textInput,
        'Timestamp': dateString
      });
    });

    // Generate Excel spreadsheet in-memory
    const worksheet = xlsx.utils.json_to_sheet(rawData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Submissions');
    
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Stream Excel file back to the browser download
    res.setHeader('Content-Disposition', 'attachment; filename="monthly_export.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    console.error('Export failed:', error);
    res.status(500).send('Failed to generate spreadsheet.');
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`App running on port ${PORT}`));
