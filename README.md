# 🚀 Azure Connected Job Tracker

A personal, simple, and clean Job Application Tracker connected to **Azure Blob Storage** for database persistence. Built with Node.js, Express, and Vanilla JavaScript.

---

## 🛠️ Step-by-Step Setup Guide

### 1. Create an Azure Storage Account
1. Log in to the [Azure Portal](https://portal.azure.com/).
2. Search for **Storage accounts** in the search bar and click **Create**.
3. Fill in the basics:
   - **Subscription / Resource Group**: Select your active subscription and resource group.
   - **Storage account name**: Choose a unique name (e.g., `karthickjobtracker`).
   - **Region**: Select a region close to your target users.
   - **Performance**: Standard (Recommended) or Premium.
   - **Redundancy**: Locally-redundant storage (LRS) is sufficient and the most cost-effective.
4. Click **Review + create** and then click **Create**.

### 2. Retrieve your Connection String
1. Once the deployment finishes, navigate to your new storage account resource.
2. In the left-hand navigation pane, scroll down to **Security + networking** and select **Access keys**.
3. Click **Show keys** at the top.
4. Copy the **Connection string** text under `key1` (it begins with `DefaultEndpointsProtocol=https;AccountName=...`).

### 3. Configure Environment Variables
1. Open the `.env` file located inside the `Job_Tracker/` directory:
   [Job_Tracker/.env](file:///d:/Job_Tracker/.env)
2. Set the variables:
   - `AZURE_STORAGE_CONNECTION_STRING`: Paste the connection string you copied in Step 2.
   - `AZURE_CONTAINER_NAME`: Specify a container name (e.g., `jobtracker`). The server will automatically create it if it doesn't exist.
   - `AZURE_BLOB_NAME`: The name of the file to save (defaults to `applications.json`).
3. Save the file.

### 4. Run Locally
To run the server and UI on your computer:
1. Open your terminal and navigate to the `Job_Tracker` directory:
   ```bash
   cd Job_Tracker
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open **[http://localhost:5000](http://localhost:5000)** in your browser.

*Note: On your first load, the server will automatically create the container and initialize `applications.json` with 3 demo rows to show you the layout.*

---

## 🌐 Deploy Online (Free)

You can host this application online for free so you can access it on your phone or any computer:

### Option A: Render (Easiest for Node/Express)
1. Push this folder to your GitHub repository.
2. Create a free account on [Render.com](https://render.com/).
3. Click **New +** and select **Web Service**.
4. Connect your GitHub repository.
5. Set the following configuration:
   - **Name**: `karthick-job-tracker`
   - **Root Directory**: `Job_Tracker`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
6. Click **Advanced** and add Environment Variables:
   - `AZURE_STORAGE_CONNECTION_STRING`: (Your Azure Connection String copied in Step 2)
   - `PORT`: `10000`
7. Click **Create Web Service**. Render will deploy it and give you a free public link (e.g., `https://karthick-job-tracker.onrender.com`).

---

## 📝 File Directory
- **`server.js`**: Backend Express app & Azure Blob Storage connection logic.
- **`public/`**: Static frontend files served by Express.
  - **`index.html`**: Clean dashboard interface with a Light/Dark theme toggle.
  - **`style.css`**: Professional slate/indigo styling and theme variables.
  - **`app.js`**: Frontend logic communicating with the REST API.
