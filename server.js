const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../'));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/knowledgescout';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB successfully'))
  .catch(err => {
    console.log('❌ MongoDB connection error:', err.message);
  });

// MongoDB Schemas
const documentSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  filePath: String,
  fileSize: Number,
  uploadDate: { type: Date, default: Date.now },
  processed: { type: Boolean, default: false },
  content: String,
  extractedText: String,
  wordCount: Number
});

const querySchema = new mongoose.Schema({
  documentId: mongoose.Schema.Types.ObjectId,
  question: String,
  answer: String,
  timestamp: { type: Date, default: Date.now },
  confidence: Number,
  sources: [String]
});

const Document = mongoose.model('Document', documentSchema);
const Query = mongoose.model('Query', querySchema);

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    allowedTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

// Text Extraction Functions
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

async function extractTextFromDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX');
  }
}

function extractTextFromTXT(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('TXT extraction error:', error);
    throw new Error('Failed to extract text from TXT');
  }
}

async function extractTextFromFile(filePath, mimeType) {
  try {
    if (mimeType === 'application/pdf') {
      return await extractTextFromPDF(filePath);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await extractTextFromDOCX(filePath);
    } else if (mimeType === 'text/plain') {
      return extractTextFromTXT(filePath);
    } else {
      throw new Error('Unsupported file type for text extraction');
    }
  } catch (error) {
    console.error('Text extraction failed:', error);
    throw error;
  }
}

// Enhanced Answer Generation based on actual content
function generateAnswerFromContent(question, documentText) {
  if (!documentText || documentText.trim().length < 50) {
    return generateFallbackAnswer(question);
  }

  const sentences = documentText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const words = documentText.toLowerCase().split(/\s+/);
  const questionWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  // Find relevant sentences based on keyword matching
  const relevantSentences = sentences.filter(sentence => {
    const sentenceLower = sentence.toLowerCase();
    return questionWords.some(word => sentenceLower.includes(word));
  });

  // If we found relevant sentences, use them
  if (relevantSentences.length > 0) {
    const bestSentence = relevantSentences[0];
    const supportingSentences = relevantSentences.slice(1, 3).filter(s => s !== bestSentence);
    
    let answer = `Based on the document: ${bestSentence.trim()}`;
    if (supportingSentences.length > 0) {
      answer += ` Additionally, ${supportingSentences.join(' ')}`;
    }
    
    return {
      answer: answer,
      confidence: Math.min(0.7 + (relevantSentences.length * 0.1), 0.95),
      sources: ['Document Content Analysis']
    };
  }

  // Fallback to document summary for general questions
  if (question.toLowerCase().includes('summary') || question.toLowerCase().includes('overview')) {
    const firstParagraph = sentences.slice(0, 3).join('. ');
    return {
      answer: `Document summary: ${firstParagraph}`,
      confidence: 0.8,
      sources: ['Document Introduction']
    };
  }

  // Fallback for other questions
  return generateContextualAnswer(question, documentText);
}

function generateContextualAnswer(question, documentText) {
  const sentences = documentText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Try to find sentences with relevant context
  const questionType = getQuestionType(question);
  const relevantContext = findRelevantContext(questionType, sentences);
  
  if (relevantContext) {
    return {
      answer: `The document mentions: ${relevantContext}`,
      confidence: 0.75,
      sources: ['Relevant Document Section']
    };
  }
  
  // Final fallback
  return {
    answer: generateFallbackAnswer(question),
    confidence: 0.6,
    sources: ['General Document Analysis']
  };
}

function getQuestionType(question) {
  const lowerQ = question.toLowerCase();
  if (lowerQ.includes('what')) return 'what';
  if (lowerQ.includes('how')) return 'how';
  if (lowerQ.includes('why')) return 'why';
  if (lowerQ.includes('when')) return 'when';
  if (lowerQ.includes('where')) return 'where';
  if (lowerQ.includes('who')) return 'who';
  return 'general';
}

function findRelevantContext(questionType, sentences) {
  // Simple keyword matching based on question type
  const keywords = {
    what: ['is', 'are', 'means', 'definition', 'concept'],
    how: ['process', 'method', 'steps', 'procedure', 'works'],
    why: ['because', 'reason', 'purpose', 'benefit', 'advantage'],
    when: ['date', 'time', 'period', 'schedule', 'timeline'],
    where: ['location', 'place', 'area', 'region', 'site']
  };

  const relevantKeywords = keywords[questionType] || [];
  
  for (let sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    if (relevantKeywords.some(keyword => lowerSentence.includes(keyword))) {
      return sentence.trim();
    }
  }
  
  // Return first substantial sentence if no matches found
  return sentences.length > 0 ? sentences[0].trim() : null;
}

function generateFallbackAnswer(question) {
  const fallbackAnswers = {
    what: "The document discusses various topics, but I couldn't find specific information about your question. Could you rephrase or ask about a different aspect?",
    how: "The methodology isn't clearly specified in the accessible content. You might want to check specific sections of the document for procedural details.",
    why: "The reasoning behind this isn't explicitly stated in the extracted content. The document may contain this information in other sections.",
    general: "I've reviewed the document content, but couldn't find specific information addressing your question. The document might cover this topic in sections that weren't fully processed."
  };

  const questionType = getQuestionType(question);
  return fallbackAnswers[questionType] || fallbackAnswers.general;
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'KnowledgeScout API with Real Text Extraction',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Enhanced Upload Endpoint
app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const document = new Document({
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size
    });

    await document.save();
    
    res.json({
      message: 'File uploaded successfully',
      document: {
        id: document._id,
        filename: document.originalName,
        size: document.fileSize,
        uploadDate: document.uploadDate
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Enhanced Process Endpoint with Real Text Extraction
app.post('/api/process/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Extract text from the file
    let extractedText;
    try {
      extractedText = await extractTextFromFile(document.filePath, getMimeType(document.originalName));
      
      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('No meaningful text extracted from document');
      }
    } catch (extractionError) {
      console.error('Text extraction failed:', extractionError);
      return res.status(400).json({ 
        error:` Failed to process document: ${extractionError.message}. The document may be scanned, encrypted, or contain no extractable text.`
      });
    }

    // Update document with extracted text
    document.processed = true;
    document.extractedText = extractedText;
    document.wordCount = extractedText.split(/\s+/).length;
    document.content = `Document processed successfully. Extracted ${document.wordCount} words of text.`;

    await document.save();

    res.json({
      message: 'Document processed successfully with text extraction',
      document: {
        id: document._id,
        filename: document.originalName,
        processed: document.processed,
        wordCount: document.wordCount,
        preview: extractedText.substring(0, 200) + '...'
      }
    });
  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ error: 'Failed to process document' });
  }
});

function getMimeType(filename) {
  if (filename.endsWith('.pdf')) return 'application/pdf';
  if (filename.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (filename.endsWith('.doc')) return 'application/msword';
  if (filename.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

// Enhanced Q&A Endpoint with Real Document Analysis
app.post('/api/ask', async (req, res) => {
  try {
    const { documentId, question } = req.body;
    
    if (!documentId || !question) {
      return res.status(400).json({ error: 'Document ID and question are required' });
    }

    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!document.processed) {
      return res.status(400).json({ error: 'Document not processed yet' });
    }

    if (!document.extractedText) {
      return res.status(400).json({ error: 'No text content available for analysis' });
    }

    // Generate answer based on actual document content
    const result = generateAnswerFromContent(question, document.extractedText);

    // Save query to database
    const query = new Query({
      documentId: document._id,
      question: question,
      answer: result.answer,
      confidence: result.confidence,
      sources: result.sources
    });

    await query.save();

    // Simulate processing time
    const delay = 1000 + Math.random() * 1000;
    
    setTimeout(() => {
      res.json({
        question: question,
        answer: result.answer,
        queryId: query._id,
        confidence: result.confidence,
        timestamp: new Date().toISOString(),
        sources: result.sources,
        analysis: 'Real document content analysis'
      });
    }, delay);

  } catch (error) {
    console.error('Q&A error:', error);
    res.status(500).json({ error: 'Failed to process question' });
  }
});

// Get document content endpoint
app.get('/api/documents/:id/content', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      id: document._id,
      filename: document.originalName,
      wordCount: document.wordCount,
      content: document.extractedText ? document.extractedText.substring(0, 1000) + '...' : null,
      fullContentAvailable: !!document.extractedText
    });
  } catch (error) {
    console.error('Content fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch document content' });
  }
});

// Get all documents endpoint
app.get('/api/documents', async (req, res) => {
  try {
    const documents = await Document.find().sort({ uploadDate: -1 });
    res.json(documents);
  } catch (error) {
    console.error('Documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get query history endpoint
app.get('/api/history/:documentId', async (req, res) => {
  try {
    const queries = await Query.find({ documentId: req.params.id }).sort({ timestamp: -1 }).limit(50);
    res.json(queries);
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Error handling
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`🚀 KnowledgeScout Real Text Analysis Server running on port ${PORT}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`📚 Features: Real PDF/DOCX/TXT text extraction • Content-based Q&A • Actual file analysis`);
});