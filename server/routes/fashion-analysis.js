// routes/fashion-analysis.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Python script path (adjust to your project structure)
const PYTHON_SCRIPT = path.join(__dirname, '../pklrunner.py');
const MODEL_PATH = path.join(__dirname, '../unified_model.pkl');

router.post('/analyze', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  const imagePath = req.file.path;
  const outputJsonPath = path.join(path.dirname(imagePath), `results-${Date.now()}.json`);
  const outputImagePath = path.join(path.dirname(imagePath), `vis-${req.file.filename}`);

  try {
    // Run Python script
    const pythonArgs = [
      PYTHON_SCRIPT,
      '--model', MODEL_PATH,
      '--image', imagePath,
      '--json_out', outputJsonPath,
      '--save', outputImagePath,
      '--topk', '10',
      '--score_thr', '0.7'
    ];

    const pythonProcess = spawn('python', pythonArgs);
    
    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      console.log('Python stdout:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', async (code) => {
      try {
        // Clean up uploaded image
        await fs.unlink(imagePath).catch(err => console.error('Failed to delete temp image:', err));

        if (code !== 0) {
          return res.status(500).json({
            error: 'Fashion analysis failed',
            details: stderrData || stdoutData
          });
        }

        // Read the results JSON
        let results = null;
        try {
          const jsonData = await fs.readFile(outputJsonPath, 'utf8');
          results = JSON.parse(jsonData);
          await fs.unlink(outputJsonPath).catch(err => console.error('Failed to delete JSON:', err));
        } catch (err) {
          console.error('Failed to read results JSON:', err);
        }

        // Read visualization image if it exists
        let visualizationBase64 = null;
        try {
          const imageBuffer = await fs.readFile(outputImagePath);
          visualizationBase64 = imageBuffer.toString('base64');
          await fs.unlink(outputImagePath).catch(err => console.error('Failed to delete vis image:', err));
        } catch (err) {
          console.error('Failed to read visualization image:', err);
        }

        res.json({
          success: true,
          results: results,
          visualization: visualizationBase64 ? `data:image/jpeg;base64,${visualizationBase64}` : null,
          rawOutput: stdoutData
        });

      } catch (error) {
        console.error('Error processing results:', error);
        res.status(500).json({
          error: 'Failed to process analysis results',
          details: error.message
        });
      }
    });

  } catch (error) {
    console.error('Error analyzing image:', error);
    
    // Clean up on error
    try {
      await fs.unlink(imagePath);
    } catch (err) {
      console.error('Failed to clean up:', err);
    }
    
    res.status(500).json({
      error: 'Failed to analyze image',
      details: error.message
    });
  }
});

module.exports = router;