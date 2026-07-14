const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Azure Blob Storage Configuration
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_CONTAINER_NAME || 'jobtracker';
const blobName = process.env.AZURE_BLOB_NAME || 'applications.json';

let useMockStorage = false;
let blobServiceClient;

if (!connectionString || connectionString.includes('YOUR_AZURE_CONNECTION_STRING')) {
  console.warn('⚠️ AZURE_STORAGE_CONNECTION_STRING is not defined or is a placeholder!');
  console.warn('⚠️ Server will run with local in-memory MOCK STORAGE for development.');
  useMockStorage = true;
} else {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    console.log('✅ Azure Blob Storage service client initialized');
  } catch (err) {
    console.error('❌ Failed to initialize Azure Blob Storage Client:', err.message);
    console.warn('⚠️ Falling back to in-memory MOCK STORAGE.');
    useMockStorage = true;
  }
}

// In-Memory Persistent Mock Database for dev fallback
let mockApplications = getDemoData();

function getBlobClient() {
  const containerClient = blobServiceClient.getContainerClient(containerName);
  return containerClient.getBlockBlobClient(blobName);
}

// Stream helper to read Azure Blob downloaded output
async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

// Helper: Load applications
async function loadApplicationsFromBlob() {
  if (useMockStorage) {
    return mockApplications;
  }

  try {
    const blobClient = getBlobClient();
    const exists = await blobClient.exists();
    if (!exists) {
      // Ensure container exists and seed initial demo data
      const containerClient = blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();
      
      const demoData = getDemoData();
      await saveApplicationsToBlob(demoData);
      return demoData;
    }
    
    const downloadBlockBlobResponse = await blobClient.download(0);
    const blobContent = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody);
    return JSON.parse(blobContent.toString());
  } catch (err) {
    console.error('❌ Error reading from Azure Blob Storage:', err.message);
    return [];
  }
}

// Helper: Save applications
async function saveApplicationsToBlob(data) {
  if (useMockStorage) {
    mockApplications = data;
    return;
  }

  try {
    const blobClient = getBlobClient();
    const content = JSON.stringify(data, null, 2);
    await blobClient.upload(content, content.length);
  } catch (err) {
    console.error('❌ Error writing to Azure Blob Storage:', err.message);
    throw err;
  }
}

// Demo data seeding template
function getDemoData() {
  return [
    {
      _id: 'demo-1',
      date: new Date().toISOString().split('T')[0],
      company: 'Emirates NBD',
      role: 'BI Analyst',
      domain: 'Banking & Finance',
      region: 'UAE',
      resume: 'Karthick_Raja_BI_Analyst.docx',
      status: 'interview',
      priority: 'high',
      next: 'Prepare SQL & Power BI case study for round 2',
      contact: 'sarah@emiratesnbd.com',
      link: 'https://www.emiratesnbd.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'demo-2',
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // yesterday
      company: 'Apollo Hospitals',
      role: 'Data Analyst',
      domain: 'Healthcare',
      region: 'India',
      resume: 'Karthick_Raja_Data_Analyst.docx',
      status: 'applied',
      priority: 'medium',
      next: 'Follow up in 5 days',
      contact: 'hr@apollo.in',
      link: 'https://www.apollohospitals.com',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      _id: 'demo-3',
      date: new Date(Date.now() - 172800000).toISOString().split('T')[0], // 2 days ago
      company: 'Siemens',
      role: 'Power BI Developer',
      domain: 'Manufacturing & IoT',
      region: 'UAE',
      resume: 'Karthick_Raja_Power_BI_Developer.docx',
      status: 'screening',
      priority: 'high',
      next: 'HR introductory call scheduled',
      contact: 'careers@siemens.com',
      link: 'https://siemens.com',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString()
    }
  ];
}

// --- REST API ENDPOINTS ---

// Get all applications
app.get('/api/applications', async (req, res) => {
  try {
    const apps = await loadApplicationsFromBlob();
    // Sort applications by date descending (matching original Mongoose sort behavior)
    apps.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: 'Server error retrieving applications', details: err.message });
  }
});

// Create a new application
app.post('/api/applications', async (req, res) => {
  try {
    const apps = await loadApplicationsFromBlob();
    
    const newApp = {
      _id: crypto.randomUUID(),
      company:     req.body.company,
      date:        req.body.date,
      role:        req.body.role,
      domain:      req.body.domain      || '',
      region:      req.body.region      || 'UAE',
      resume:      req.body.resume      || '',
      status:      req.body.status      || 'applied',
      priority:    req.body.priority    || 'medium',
      next:        req.body.next        || '',
      followupDate: req.body.followupDate || '',
      contactName: req.body.contactName || '',
      contact:     req.body.contact     || '',
      link:        req.body.link        || '',
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString()
    };

    apps.unshift(newApp); // Add to beginning of list
    await saveApplicationsToBlob(apps);

    res.status(201).json(newApp);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create application', details: err.message });
  }
});

// Update an application
app.put('/api/applications/:id', async (req, res) => {
  try {
    const apps = await loadApplicationsFromBlob();
    const idx = apps.findIndex(x => x._id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const updatedApp = {
      ...apps[idx],
      company:     req.body.company     !== undefined ? req.body.company     : apps[idx].company,
      date:        req.body.date        !== undefined ? req.body.date        : apps[idx].date,
      role:        req.body.role        !== undefined ? req.body.role        : apps[idx].role,
      domain:      req.body.domain      !== undefined ? req.body.domain      : apps[idx].domain,
      region:      req.body.region      !== undefined ? req.body.region      : apps[idx].region,
      resume:      req.body.resume      !== undefined ? req.body.resume      : apps[idx].resume,
      status:      req.body.status      !== undefined ? req.body.status      : apps[idx].status,
      priority:    req.body.priority    !== undefined ? req.body.priority    : apps[idx].priority,
      next:        req.body.next        !== undefined ? req.body.next        : apps[idx].next,
      followupDate: req.body.followupDate !== undefined ? req.body.followupDate : apps[idx].followupDate,
      contactName: req.body.contactName !== undefined ? req.body.contactName : apps[idx].contactName,
      contact:     req.body.contact     !== undefined ? req.body.contact     : apps[idx].contact,
      link:        req.body.link        !== undefined ? req.body.link        : apps[idx].link,
      updatedAt:   new Date().toISOString()
    };

    apps[idx] = updatedApp;
    await saveApplicationsToBlob(apps);

    res.json(updatedApp);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update application', details: err.message });
  }
});

// Delete an application
app.delete('/api/applications/:id', async (req, res) => {
  try {
    let apps = await loadApplicationsFromBlob();
    const idx = apps.findIndex(x => x._id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ error: 'Application not found' });
    }

    apps.splice(idx, 1);
    await saveApplicationsToBlob(apps);

    res.json({ message: 'Application deleted successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete application', details: err.message });
  }
});

// Fallback to serve index.html for any other frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running online at http://localhost:${PORT}`);
});
