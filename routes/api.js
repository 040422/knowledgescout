const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const Query = require('../models/Query');

// Get all documents
router.get('/documents', async (req, res) => {
    try {
        const documents = await Document.find().sort({ uploadDate: -1 });
        res.json(documents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific document
router.get('/documents/:id', async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json(document);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete document
router.delete('/documents/:id', async (req, res) => {
    try {
        const document = await Document.findByIdAndDelete(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Also delete associated queries
        await Query.deleteMany({ documentId: req.params.id });
        
        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get query history for document
router.get('/documents/:id/queries', async (req, res) => {
    try {
        const queries = await Query.find({ documentId: req.params.id })
            .sort({ timestamp: -1 });
        res.json(queries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'KnowledgeScout API'
    });
});

module.exports = router;