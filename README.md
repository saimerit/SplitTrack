# SplitTrack

**A modern expense tracking and split management application built with React, Vite, and Firebase.**

[![Apache License 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![React](https://img.shields.io/badge/React-19.x-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-purple.svg)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Hosting-orange.svg)](https://firebase.google.com/)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Firebase Setup](#3-firebase-setup)
  - [4. Environment Configuration](#4-environment-configuration)
  - [5. Run Development Server](#5-run-development-server)
- [Testing](#testing)
- [Build & Deployment](#build--deployment)
- [Project Structure](#project-structure)
- [Console Commands](#console-commands)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Core Features
- **Dashboard** - Real-time overview of expenses, income, and balances
- **Transaction Management** - Add, edit, delete, and categorize transactions
- **Split Expenses** - Split bills equally, by percentage, or custom amounts
- **Analytics** - Visual charts and insights on spending patterns
- **Calendar View** - View transactions on an interactive calendar
- **History** - Searchable transaction history with bulk operations
- **Categories & Tags** - Organize expenses with custom categories and tags

### Advanced Features  
- **Console CLI** - Power-user command-line interface for quick entries
- **Recurring Transactions** - Automate regular expenses and subscriptions
- **Sandbox Mode** - Simulate transactions before committing
- **Goals Tracking** - Set and track financial goals
- **Dark/Light Themes** - Multiple color palettes with custom theme builder
- **PWA Support** - Install as a mobile app with offline capabilities
- **Google Authentication** - Secure login with Firebase Auth

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | React 19, Vite 7 |
| **Styling** | TailwindCSS 4, Custom CSS |
| **State Management** | Zustand |
| **Backend** | Firebase Firestore |
| **Authentication** | Firebase Auth (Google OAuth) |
| **Hosting** | Firebase Hosting |
| **Charts** | Chart.js, React-Chartjs-2 |
| **PWA** | Vite PWA Plugin |
| **Mobile** | Capacitor (Android) |

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (v9 or higher) - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)
- **Firebase CLI** - Install globally:
  ```bash
  npm install -g firebase-tools
  ```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/splittrack.git
cd splittrack
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Firebase Setup

#### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** or **"Add project"**
3. Enter a project name (e.g., `splittrack`)
4. Disable Google Analytics (optional) and click **Create Project**
5. Wait for the project to be created

#### Step 2: Enable Authentication

1. In Firebase Console, go to **Build → Authentication**
2. Click **"Get started"**
3. Go to **Sign-in method** tab
4. Enable **Google** provider:
   - Click on Google
   - Toggle **Enable**
   - Add your support email
   - Click **Save**

#### Step 3: Create Firestore Database

1. Go to **Build → Firestore Database**
2. Click **"Create database"**
3. Select **Start in production mode** (we'll add rules later)
4. Choose your preferred region (e.g., `us-central1`)
5. Click **Enable**

#### Step 4: Configure Firestore Security Rules

1. Go to **Firestore Database → Rules** tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Transactions collection
    match /transactions/{transactionId} {
      allow read, write: if request.auth != null;
    }
    
    // Other collections
    match /{collection}/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **Publish**

#### Step 5: Register Web App

1. In Firebase Console, click the **gear icon** → **Project settings**
2. Scroll down to **"Your apps"** section
3. Click the **Web icon** (`</>`)
4. Enter app nickname: `splittrack-web`
5. Check **"Also set up Firebase Hosting"**
6. Click **Register app**
7. Copy the Firebase configuration object (you'll need this next)

### 4. Environment Configuration

Create a `src/config/firebase.js` file with your Firebase credentials:

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

> **Important:** Add `src/config/firebase.js` to your `.gitignore` to keep credentials secure.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Testing

### Run Unit Tests

```bash
npm run test
```

### Run Tests in Watch Mode

```bash
npm run test -- --watch
```

### Run Tests with Coverage

```bash
npm run test -- --coverage
```

### Manual Testing Checklist

1. **Authentication**
   - [ ] Login with Google works
   - [ ] Logout works
   - [ ] Protected routes redirect to login

2. **Transactions**
   - [ ] Add new transaction
   - [ ] Edit existing transaction
   - [ ] Delete transaction
   - [ ] Split transaction with participants

3. **Console CLI**
   - [ ] `help` command shows help
   - [ ] `amt:100 expn:Lunch c:Food` adds transaction
   - [ ] Date formats work (`dt:19/12/2024`)

4. **Settings**
   - [ ] Theme switching works
   - [ ] Defaults are saved and applied

---

## Build & Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` folder.

### Preview Production Build

```bash
npm run preview
```

### Deploy to Firebase Hosting

#### Step 1: Login to Firebase CLI

```bash
firebase login
```

This opens a browser window for Google authentication.

#### Step 2: Initialize Firebase (First Time Only)

```bash
firebase init hosting
```

When prompted:
- Select **Use an existing project** → Choose your project
- Public directory: `dist`
- Configure as single-page app: `Yes`
- Set up automatic builds with GitHub: `No` (optional)
- Overwrite dist/index.html: `No`

#### Step 3: Deploy

```bash
npm run build && firebase deploy
```

Or deploy only hosting:

```bash
firebase deploy --only hosting
```

#### Step 4: View Your Live Site

After successful deployment, Firebase will display your live URL:
```
✔ Hosting URL: https://your-project-id.web.app
```

### Deployment Commands Summary

| Command | Description |
|---------|-------------|
| `firebase login` | Authenticate with Firebase |
| `firebase init` | Initialize Firebase in project |
| `firebase deploy` | Deploy to Firebase Hosting |
| `firebase deploy --only hosting` | Deploy only hosting |
| `firebase hosting:channel:deploy preview` | Deploy to preview channel |

---

## Project Structure

```
splittrack/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── charts/          # Chart components
│   │   ├── common/          # Buttons, inputs, modals
│   │   ├── layout/          # Layout, sidebar, header
│   │   └── transactions/    # Transaction-related components
│   ├── config/              # Firebase configuration
│   ├── hooks/               # Custom React hooks
│   ├── pages/               # Page components
│   │   ├── Dashboard.jsx
│   │   ├── Analytics.jsx
│   │   ├── Calendar.jsx
│   │   ├── Console.jsx
│   │   ├── History.jsx
│   │   ├── Settings.jsx
│   │   └── ...
│   ├── services/            # API and Firebase services
│   ├── store/               # Zustand state management
│   ├── utils/               # Helper functions
│   ├── workers/             # Web workers for analytics
│   ├── App.jsx              # Main app component
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── public/                  # Static assets
├── documentation/           # Project documentation
├── scripts/                 # CLI and utility scripts
├── firebase.json            # Firebase configuration
├── vite.config.js           # Vite configuration
└── package.json             # Dependencies and scripts
```

---

## Console Commands

SplitTrack includes a powerful CLI for quick expense entry.

### Quick Reference

```bash
# Basic expense
amt:100 expn:Lunch c:Food

# With all options
amt:500 expn:Dinner c:Food p:Restaurant m:UPI dt:yesterday

# Split with group
amt:300 expn:Groceries g:roommates

# Exclude self from split
amt:200 expn:Supplies g:roommates inc:no

# Interactive dynamic split
amt:500 expn:Party g:friends split:dynamic
```

### Command Aliases

| Attribute | Aliases | Description |
|-----------|---------|-------------|
| amount | `a`, `amt` | Transaction amount |
| expenseName | `expn`, `name`, `n` | Expense name |
| category | `c`, `cat` | Category |
| place | `p`, `plc` | Location |
| mode | `m`, `pay`, `mop` | Payment mode |
| date | `dt`, `date` | Date (`today`, `yesterday`, `dd/mm/yyyy`) |
| group | `g`, `grp` | Split group |
| payer | `by`, `paid` | Who paid |
| includeMe | `inc` | Include self in split (`yes`/`no`) |

> See full documentation: [documentation/commands.txt](documentation/commands.txt)

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style

- Use ES6+ syntax
- Follow React best practices
- Use meaningful variable and function names
- Add comments for complex logic

---

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

```
Copyright 2025 Sai Ardhendu Kalivarapu

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

## Acknowledgments

- [React](https://reactjs.org/) - UI Library
- [Vite](https://vitejs.dev/) - Build Tool
- [Firebase](https://firebase.google.com/) - Backend & Hosting
- [TailwindCSS](https://tailwindcss.com/) - Styling
- [Lucide React](https://lucide.dev/) - Icons
- [Chart.js](https://www.chartjs.org/) - Charts

---

<p align="center">
  Made with care by Sai Ardhendu
</p>
